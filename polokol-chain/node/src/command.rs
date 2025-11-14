use crate::chain_spec;
use crate::cli::{Cli, Subcommand};
use sc_cli::SubstrateCli;

pub fn run() -> sc_cli::Result<()> {
    let cli = Cli::from_args();

    match &cli.subcommand {
        Some(Subcommand::BuildSpec(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run(config.chain_spec, config.network))
        }
        Some(Subcommand::CheckBlock(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let (client, _, import_queue, task_manager) =
                    crate::service::new_full_parts(&config)?;
                Ok((cmd.run(client, import_queue), task_manager))
            })
        }
        Some(Subcommand::ExportBlocks(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let (client, _, _, task_manager) = crate::service::new_full_parts(&config)?;
                Ok((cmd.run(client, config.database), task_manager))
            })
        }
        Some(Subcommand::ImportBlocks(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let (client, _, import_queue, task_manager) =
                    crate::service::new_full_parts(&config)?;
                Ok((cmd.run(client, import_queue), task_manager))
            })
        }
        Some(Subcommand::Key(cmd)) => cmd.run(&cli),
        Some(Subcommand::PurgeChain(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run(config.database))
        }
        Some(Subcommand::Revert(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let (client, _, _, task_manager) = crate::service::new_full_parts(&config)?;
                Ok((cmd.run(client), task_manager))
            })
        }
        None => {
            let runner = cli.create_runner(&cli.run)?;
            runner.run_node_until_exit(|config| async move {
                crate::service::new_full(config).map_err(sc_cli::Error::Service)
            })
        }
    }
}

impl SubstrateCli for Cli {
    fn impl_name() -> String {
        "Polokol Node".into()
    }

    fn impl_version() -> String {
        env!("CARGO_PKG_VERSION").into()
    }

    fn description() -> String {
        "Polokol blockchain node".into()
    }

    fn author() -> String {
        env!("CARGO_PKG_AUTHORS").into()
    }

    fn support_url() -> String {
        "https://github.com/polokol/polokol".into()
    }

    fn copyright_start_year() -> i32 {
        2024
    }

    fn executable_name() -> String {
        "polokol-node".into()
    }

    fn load_spec(&self, id: &str) -> Result<Box<dyn sc_service::ChainSpec>, String> {
        Ok(match id {
            "dev" => Box::new(chain_spec::dev_config()),
            "" | "local" => Box::new(chain_spec::dev_config()),
            path => Box::new(
                sc_service::ChainSpec::from_json_file(std::path::PathBuf::from(path))?,
            ),
        })
    }

    fn native_runtime_version(_: &Box<dyn sc_service::ChainSpec>) -> &'static sp_version::RuntimeVersion {
        &polokol_runtime::VERSION
    }
}