import "dotenv/config";
import { connectDaoChain, loadTransportConfig } from "./substrateClient";

export async function sendSystemRemark(): Promise<void> {
  const { api, admin } = await connectDaoChain();
  const transportConfig = loadTransportConfig();

  const adminSeed = process.env.DAOCHAIN_ADMIN_SEED ?? "//Alice";
  // admin is already from env in connectDaoChain; if different, override:
  const signer = admin.meta.source ? admin : (() => {
    const { Keyring } = require("@polkadot/keyring");
    const keyring = new Keyring({ type: "sr25519" });
    return keyring.addFromUri(adminSeed);
  })();

  const remark = process.env.DAOCHAIN_DEBUG_REMARK ?? "DaoMix debug";
  const tx = api.tx.system.remark(remark);

  return new Promise<void>((resolve, reject) => {
    tx.signAndSend(signer, (result: any) => {
      const { status, dispatchError, events } = result;
      if (dispatchError) {
        console.error("[Debug] system.remark dispatchError:", dispatchError.toString());
        reject(dispatchError.toString());
        return;
      }
      if (status?.isInBlock || status?.isFinalized) {
        console.log("[Debug] system.remark included at", status.toString());
        (events || []).forEach(({ event }: any) =>
          console.log("[Debug] event:", event.toHuman()),
        );
        resolve();
      }
    }).catch(reject);
  }).finally(async () => {
    await api.disconnect();
  });
}

if (require.main === module) {
  sendSystemRemark()
    .then(() => {
      console.log("[Debug] system.remark success");
      process.exit(0);
    })
    .catch(err => {
      console.error("[Debug] system.remark failed:", err);
      process.exit(1);
    });
}


