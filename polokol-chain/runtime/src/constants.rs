pub mod currency {
    use sp_runtime::Perbill;

    pub const MILLICENTS: u128 = 1_000_000_000;
    pub const CENTS: u128 = 1_000 * MILLICENTS;
    pub const DOLLARS: u128 = 100 * CENTS;

    pub const fn deposit(items: u32, bytes: u32) -> u128 {
        items as u128 * 15 * CENTS + (bytes as u128) * 6 * CENTS
    }
}
