//! Unsigned, native-ETH EIP-1559 signing preimages for Ethereum Sepolia only.

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EthTransaction {
    pub nonce: u64,
    pub value_wei: u128,
    pub max_fee_per_gas: u128,
    pub max_priority_fee_per_gas: u128,
    pub gas_limit: u64,
}

/// Returns `0x02 || rlp([chain_id, nonce, priority_fee, max_fee, gas, to,
/// value, empty_data, empty_access_list])`, without signature fields or hashing.
///
/// `to` must come from the contract's locked, stored destination, not caller input.
/// The caller must enforce its gas policy (at least 21,000 and its chosen upper
/// bound) and authorization before requesting a signature.
///
/// # Panics
/// Panics if either fee is zero or the priority fee exceeds the maximum fee.
pub fn encode_unsigned(tx: &EthTransaction, to: &[u8; 20]) -> Vec<u8> {
    assert!(tx.max_fee_per_gas > 0, "Maximum fee must be positive");
    assert!(
        tx.max_priority_fee_per_gas > 0,
        "Priority fee must be positive"
    );
    assert!(
        tx.max_priority_fee_per_gas <= tx.max_fee_per_gas,
        "Priority fee exceeds maximum fee"
    );

    let mut payload = Vec::with_capacity(96);
    encode_integer(11_155_111, &mut payload);
    encode_integer(u128::from(tx.nonce), &mut payload);
    encode_integer(tx.max_priority_fee_per_gas, &mut payload);
    encode_integer(tx.max_fee_per_gas, &mut payload);
    encode_integer(u128::from(tx.gas_limit), &mut payload);
    encode_bytes(to, &mut payload);
    encode_integer(tx.value_wei, &mut payload);
    payload.push(0x80); // Empty calldata is a string, not a list.
    payload.push(0xc0); // Empty access list is a list, not a string.

    let mut encoded = Vec::with_capacity(payload.len() + 3);
    encoded.push(0x02);
    encode_length(payload.len(), 0xc0, &mut encoded);
    encoded.extend_from_slice(&payload);
    encoded
}

fn encode_integer(value: u128, output: &mut Vec<u8>) {
    let bytes = value.to_be_bytes();
    let first = bytes.iter().position(|&byte| byte != 0).unwrap_or(bytes.len());
    encode_bytes(&bytes[first..], output);
}

fn encode_bytes(bytes: &[u8], output: &mut Vec<u8>) {
    if bytes.len() == 1 && bytes[0] < 0x80 {
        output.push(bytes[0]);
    } else {
        encode_length(bytes.len(), 0x80, output);
        output.extend_from_slice(bytes);
    }
}

fn encode_length(length: usize, offset: u8, output: &mut Vec<u8>) {
    if length <= 55 {
        output.push(offset + length as u8);
    } else {
        let bytes = length.to_be_bytes();
        let first = bytes.iter().position(|&byte| byte != 0).unwrap();
        let length_bytes = &bytes[first..];
        output.push(offset + 55 + length_bytes.len() as u8);
        output.extend_from_slice(length_bytes);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn transaction() -> EthTransaction {
        EthTransaction {
            nonce: 0,
            value_wei: 0,
            max_fee_per_gas: 2,
            max_priority_fee_per_gas: 1,
            gas_limit: 21_000,
        }
    }

    #[test]
    fn zero_nonce_and_value_use_empty_strings() {
        // Independently hand-derived RLP, not a claimed viem-generated vector.
        let mut expected = vec![
            0x02, 0xe2, 0x83, 0xaa, 0x36, 0xa7, 0x80, 0x01, 0x02,
            0x82, 0x52, 0x08, 0x94,
        ];
        expected.extend_from_slice(&[0x11; 20]);
        expected.extend_from_slice(&[0x80, 0x80, 0xc0]);
        assert_eq!(encode_unsigned(&transaction(), &[0x11; 20]), expected);
    }

    #[test]
    fn integer_encoding_is_minimal_at_boundaries() {
        for (value, expected) in [
            (0, vec![0x80]),
            (1, vec![0x01]),
            (127, vec![0x7f]),
            (128, vec![0x81, 0x80]),
            (255, vec![0x81, 0xff]),
            (256, vec![0x82, 0x01, 0x00]),
        ] {
            let mut actual = Vec::new();
            encode_integer(value, &mut actual);
            assert_eq!(actual, expected, "integer {value}");
        }
    }

    #[test]
    fn max_u128_fields_and_long_transaction_list() {
        let tx = EthTransaction {
            nonce: u64::MAX,
            value_wei: u128::MAX,
            max_fee_per_gas: u128::MAX,
            max_priority_fee_per_gas: u128::MAX,
            gas_limit: 21_000,
        };
        // The nine encoded fields occupy 90 bytes, requiring long-list form.
        let mut expected = vec![0x02, 0xf8, 90, 0x83, 0xaa, 0x36, 0xa7, 0x88];
        expected.extend_from_slice(&[0xff; 8]);
        for _ in 0..2 {
            expected.push(0x90);
            expected.extend_from_slice(&[0xff; 16]);
        }
        expected.extend_from_slice(&[0x82, 0x52, 0x08, 0x94]);
        expected.extend_from_slice(&[0x00; 20]);
        expected.push(0x90);
        expected.extend_from_slice(&[0xff; 16]);
        expected.extend_from_slice(&[0x80, 0xc0]);
        assert_eq!(encode_unsigned(&tx, &[0x00; 20]), expected);
    }

    #[test]
    fn list_length_prefix_boundaries() {
        for (length, expected) in [
            (0, vec![0xc0]),
            (55, vec![0xf7]),
            (56, vec![0xf8, 0x38]),
            (255, vec![0xf8, 0xff]),
            (256, vec![0xf9, 0x01, 0x00]),
        ] {
            let mut actual = Vec::new();
            encode_length(length, 0xc0, &mut actual);
            assert_eq!(actual, expected, "payload length {length}");
        }
    }

    #[test]
    #[should_panic(expected = "Maximum fee must be positive")]
    fn rejects_zero_maximum_fee() {
        let mut tx = transaction();
        tx.max_fee_per_gas = 0;
        encode_unsigned(&tx, &[0x11; 20]);
    }

    #[test]
    #[should_panic(expected = "Priority fee must be positive")]
    fn rejects_zero_priority_fee() {
        let mut tx = transaction();
        tx.max_priority_fee_per_gas = 0;
        encode_unsigned(&tx, &[0x11; 20]);
    }

    #[test]
    #[should_panic(expected = "Priority fee exceeds maximum fee")]
    fn rejects_priority_above_maximum_fee() {
        let mut tx = transaction();
        tx.max_priority_fee_per_gas = 3;
        encode_unsigned(&tx, &[0x11; 20]);
    }
}
