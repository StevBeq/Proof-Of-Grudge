//! Use the canonical DTOs rather than duplicating the MPC wire format.
//! Source revision and serialization details are documented in contract/README.md.
use near_mpc_contract_interface::{
    call_args::SignArgs,
    types::{DomainId, Payload, SignRequestArgs, SignatureResponse},
};
use near_sdk::serde_json;

pub const CONTRACT: &str = "v1.signer-prod.testnet";
pub const PATH: &str = "ethereum-1";

pub fn arguments(hash: [u8; 32]) -> Vec<u8> {
    let args = SignArgs {
        request: SignRequestArgs {
            path: PATH.to_owned(),
            payload: Payload::from_legacy_ecdsa(hash),
            domain_id: DomainId(0),
        },
    };
    // The official serializer renames the Rust `payload` field to `payload_v2`.
    serde_json::to_vec(&args).expect("MPC arguments serialize")
}

pub fn valid_response(bytes: &[u8]) -> bool {
    if bytes.len() > 1024 {
        return false;
    }
    matches!(
        serde_json::from_slice::<SignatureResponse>(bytes),
        Ok(SignatureResponse::Secp256k1(signature)) if signature.recovery_id <= 1
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn official_wire_format_uses_v2_and_domain_zero() {
        let value: serde_json::Value = serde_json::from_slice(&arguments([7; 32])).unwrap();
        let request = &value["request"];
        assert_eq!(request["domain_id"], 0);
        assert_eq!(request["path"], "ethereum-1");
        assert_eq!(request["payload_v2"]["Ecdsa"], "07".repeat(32));
        assert!(request.get("payload").is_none());
        assert!(request.get("key_version").is_none());
    }
    #[test]
    fn rejects_malformed_or_wrong_scheme_response() {
        assert!(!valid_response(b"null"));
        assert!(!valid_response(br#"{"scheme":"Ed25519","signature":[]}"#));
        assert!(!valid_response(&vec![0; 1025]));
    }
}
