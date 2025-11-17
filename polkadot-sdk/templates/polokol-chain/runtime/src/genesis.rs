#![cfg(feature = "std")]

use crate::runtime::{Runtime, GenesisConfig, WASM_BINARY, SLOT_DURATION};

pub fn testnet_genesis() -> GenesisConfig {
    GenesisConfig {
        system: frame_system::GenesisConfig {
            code: WASM_BINARY.expect("WASM binary not available").to_vec(),
            ..Default::default()
        },
        timestamp: pallet_timestamp::GenesisConfig {
            minimum_period: SLOT_DURATION / 2,
        },
        balances: pallet_balances::GenesisConfig {
            balances: vec![],
        },
        sudo: pallet_sudo::GenesisConfig {
            key: Some(sp_core::sr25519::Pair::from_string("//Alice", None)
                .unwrap()
                .public()
                .into()),
        },
        transaction_payment: pallet_transaction_payment::GenesisConfig {},
        dao_voting: pallet_dao_voting::GenesisConfig::default(),
        mixnet_registry: pallet_mixnet_registry::GenesisConfig::default(),
    }
}