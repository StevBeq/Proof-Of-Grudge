use near_sdk::serde_json::{self, Value};
use proof_of_grudge::eth_rlp::{encode_unsigned, EthTransaction};
use std::{fs, path::Path};

const GENERATE: &str = "From contract/: run `npm install` then `npm run vectors`; commit vectors/eip1559.generated.json, then run `cargo test --test rlp_golden`. Generation is local and uses no RPC or secrets.";

fn read_json(path: &Path) -> Value {
    let contents = fs::read_to_string(path)
        .unwrap_or_else(|error| panic!("Cannot read {}: {error}. {GENERATE}", path.display()));
    serde_json::from_str(&contents)
        .unwrap_or_else(|error| panic!("Invalid JSON in {}: {error}. {GENERATE}", path.display()))
}

fn text<'a>(value: &'a Value, field: &str) -> &'a str {
    value[field]
        .as_str()
        .unwrap_or_else(|| panic!("Fixture field {field} must be a string"))
}

fn decimal<T: std::str::FromStr>(value: &Value, field: &str) -> T {
    text(value, field)
        .parse()
        .unwrap_or_else(|_| panic!("Fixture field {field} is outside its integer range"))
}

fn decode_hex(hex: &str) -> Vec<u8> {
    let hex = hex.strip_prefix("0x").expect("Fixture hex must start with 0x");
    assert_eq!(hex.len() % 2, 0, "Fixture hex must contain complete bytes");
    hex.as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let digits = std::str::from_utf8(pair).expect("Fixture hex must be ASCII");
            u8::from_str_radix(digits, 16).expect("Invalid fixture hex byte")
        })
        .collect()
}

#[test]
fn unsigned_eip1559_matches_pinned_viem_byte_for_byte() {
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("vectors");
    // Runtime reads deliberately allow compilation before the fixture exists.
    // A missing fixture is a hard test failure, never an ignored or skipped test.
    let fixture = read_json(&directory.join("eip1559.generated.json"));
    let inputs = read_json(&directory.join("eip1559.inputs.json"));
    assert_eq!(fixture["schema_version"], 1, "Unknown fixture schema");
    assert_eq!(fixture["provenance"]["library"], "viem");
    assert_eq!(fixture["provenance"]["version"], "2.57.19");
    assert_eq!(fixture["provenance"]["serializer"], "serializeTransaction");
    assert_eq!(fixture["provenance"]["generator"], "vectors/generate.mjs");
    assert_eq!(fixture["inputs"], inputs, "Stale fixture inputs. {GENERATE}");
    assert_eq!(inputs["schema_version"], 1);
    assert_eq!(inputs["chain_id"], 11_155_111);
    assert_eq!(inputs["data"], "0x");
    assert_eq!(inputs["access_list"], serde_json::json!([]));

    let cases = inputs["cases"].as_array().expect("Missing input cases");
    let vectors = fixture["vectors"].as_array().expect("Missing generated vectors");
    assert_eq!(cases.len(), 3, "All three requested input cases are required");
    assert_eq!(vectors.len(), cases.len(), "Missing or extra golden vectors");
    let mut names = std::collections::BTreeSet::new();
    for (input, reference) in cases.iter().zip(vectors) {
        let name = text(input, "name");
        assert!(names.insert(name), "Duplicate case name: {name}");
        assert_eq!(text(reference, "name"), name, "Vector order/name mismatch");
        let to: [u8; 20] = decode_hex(text(input, "to"))
            .try_into()
            .expect("Fixture destination must contain exactly 20 bytes");
        let tx = EthTransaction {
            nonce: decimal(input, "nonce"),
            value_wei: decimal(input, "value_wei"),
            max_fee_per_gas: decimal(input, "max_fee_per_gas"),
            max_priority_fee_per_gas: decimal(input, "max_priority_fee_per_gas"),
            gas_limit: decimal(input, "gas_limit"),
        };
        let expected = decode_hex(text(reference, "unsigned_serialized"));
        assert_eq!(expected.first(), Some(&0x02), "Expected typed envelope: {name}");
        assert_eq!(encode_unsigned(&tx, &to), expected, "viem mismatch: {name}");
    }
}
