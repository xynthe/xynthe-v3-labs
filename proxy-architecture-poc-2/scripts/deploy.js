const fs = require('fs');

async function deploy() {
  const network = 'kovan';

  // ---------------------------
  // Retrieve data file
  // ---------------------------

  const deploymentsFilePath = `./deployments/${network}.json`;
	const deployments = JSON.parse(fs.readFileSync(deploymentsFilePath));

  function saveDeploymentsFile() {
	  fs.writeFileSync(
	    deploymentsFilePath,
	    JSON.stringify(deployments, null, 2)
	  );
  }

  // ---------------------------
  // Proxy management tools
  // ---------------------------

  async function getProxy({ contract }) {
    console.log(`Retrieving proxy for ${contract}...`);

    const address = deployments[contract].proxy;
    if (!address) {
      console.log(`  > No proxy found`);
      return;
    }

    const proxy = await ethers.getContractAt(contract, address);
    console.log(`  > Proxy found at: ${proxy.address}`);

    return proxy;
  }

  async function deployProxy({ contract }) {
    console.log(`Deploying new proxy for ${contract}...`);

    const factory = await ethers.getContractFactory(contract);

    const data = deployments[contract];
    const { values, name } = data.initializer;

    const proxy = await upgrades.deployProxy(factory, values, { initializer: name });
    console.log(`  > Proxy deployed at: ${proxy.address}`);

    deployments[contract].proxy = proxy.address;
    saveDeploymentsFile();

    return proxy;
  }

  async function prepareUpgrade({ contract }) {
    console.log(`Checking for upgrades to ${contract}...`);

    const factory = await ethers.getContractFactory(contract);

    const implementationAddress = await upgrades.prepareUpgrade(addressResolver.address, factory);
    const knownImplementation = deployments[contract].implementations.pop();
    const needsUpgrade = implementationAddress.toLowerCase() !== knownImplementation.toLowerCase();
    if (!needsUpgrade) {
      console.log(`  > No changes in the current implementation`);
    } else {
      console.log(`  > Implementation should be upgraded to ${implementationAddress}`);

      deployments[contract].implementations.push(implementationAddress);
      saveDeploymentsFile();
    }

    return needsUpgrade;
  }

  async function upgradeProxy({ contract }) {
    console.log(`Upgrading proxy for ${contract}...`);

    const factory = await ethers.getContractFactory(contract);

    const proxy = await upgrades.upgradeProxy(addressResolver.address, factory);
    console.log(`Proxy upgraded`);

    return proxy;
  }

  // ---------------------------
  // Get proxy admin
  // ---------------------------

  const admin = await upgrades.admin.getInstance();
  if (admin) {
    console.log(`Proxy admin: ${admin.address}`);
  }

  // ---------------------------
  // Deploy / upgrade contracts
  // ---------------------------

  let contract;

  // AddressResolver
  contract = 'AddressResolver';
  // Retrieve proxy, or deploy a new one
  let addressResolver = await getProxy({ contract });;
  if (!addressResolver) {
    addressResolver = await deployProxy({ contract });
  } else {
    // Check if a new implementation needs to be deployed
    const needsUpgrade = await prepareUpgrade({ contract });
    if (needsUpgrade) {
      addressResolver = await upgradeProxy({ contract });
    }
  }
  console.log(`  > AddressResolver version: ${await addressResolver.version()}`);
  console.log(`  > AddressResolver uint value: ${await addressResolver.uintValue()}`);
  console.log(`  > AddressResolver string value: ${await addressResolver.stringValue()}`);
}

deploy()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });