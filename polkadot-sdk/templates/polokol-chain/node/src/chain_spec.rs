use polokol_runtime::Runtime;
use sc_service::ChainType;

pub fn dev_config() -> Result<sc_service::ChainSpec, String> {
    Ok(sc_service::ChainSpec::from_genesis(
        "Development",
        "dev",
        ChainType::Development,
        || polokol_runtime::genesis::testnet_genesis(),
        vec![],
        None,
        None,
        None,
        None,
    ))
}
