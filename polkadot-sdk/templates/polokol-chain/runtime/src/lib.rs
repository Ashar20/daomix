#![cfg_attr(not(feature = "std"), no_std)]

pub mod constants;
pub mod runtime;

pub use runtime::*;

#[cfg(feature = "std")]
pub use runtime::{GenesisConfig, WASM_BINARY};
