const { getDeploymentsFile, saveDeploymentsFile } = require('./utils/deploymentsFile');

async function main() {
  const network = hre.network.name;
  console.log(`\nUpgrading router on the ${network} network...`);

  const deployments = getDeploymentsFile({ network });

  const Router = await (
    await ethers.getContractFactory(`Router_${network}`)
  ).deploy();

  const UpgradeModule = await ethers.getContractAt('UpgradeModule', deployments.Synthetix.address);

  const tx = await UpgradeModule.upgradeTo(Router.address);
  await tx.wait();

  console.log(`  > New router implementation set: ${Router.address}`);

  deployments.Synthetix.implementations.push(Router.address);

  saveDeploymentsFile({ deployments, network });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
