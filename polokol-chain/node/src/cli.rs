use structopt::StructOpt;

#[derive(Debug, StructOpt)]
pub struct Cli {
    #[structopt(subcommand)]
    pub subcommand: Option<Subcommand>,
    #[structopt(flatten)]
    pub run: sc_cli::RunCmd,
}

#[derive(Debug, StructOpt)]
pub enum Subcommand {
    BuildSpec(sc_cli::BuildSpecCmd),
    CheckBlock(sc_cli::CheckBlockCmd),
    ExportBlocks(sc_cli::ExportBlocksCmd),
    ImportBlocks(sc_cli::ImportBlocksCmd),
    Key(sc_cli::KeySubcommand),
    PurgeChain(sc_cli::PurgeChainCmd),
    Revert(sc_cli::RevertCmd),
}

#[cfg(not(feature = "std"))]
compile_error!("`std` feature is currently required for the CLI.");

#[cfg(not(any(feature = "std", feature = "runtime-benchmarks")))]
compile_error!("Either `std` or `runtime-benchmarks` feature must be enabled.");
