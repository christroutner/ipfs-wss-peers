/*
  Scan the DHT for peers with `/wss` in their multiaddr.

  The purpose of this program is to catalog the secure websockets (wss) peers
  on the network that are also configured as circuit relays, so that they can
  be used to strengthen network connections between web browsers.

  This is a prototype program. A proof of concept. It demonstrates the approach
  taken to scan the DHT.

  Workflow:
  - 1) Connect to 5 bootstrap peers.
  - 2) use ipfs.dht.query() to get the peers 'near' those 5 boostrap peers
  - 3) use ipfs.dht.findPeer() to get the multiaddrs of the candidate peers.
  - 4) filter results into known valid an invalid wss peers.
  - 5) Loop from step 2.
*/

const IPFS = require("ipfs");

// Local library for reading and writing to JSON files.
const JsonFiles = require("./json-files");
const jsonFiles = new JsonFiles();

// Used to bootstrap IPFS connections
const bootstrapMultiaddrs = [
  "/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
  "/dns4/node0.preload.ipfs.io/tcp/443/wss/ipfs/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic",
  "/dns4/node1.preload.ipfs.io/tcp/443/wss/ipfs/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6",
  "/dns4/ipfs-service-provider.fullstackcash.nl/tcp/443/wss/ipfs/QmbyYXKbnAmMbMGo8LRBZ58jYs58anqUzY1m4jxDmhDsjd",
  "/dns4/go-ipfs-wss.fullstackcash.nl/tcp/443/wss/ipfs/QmTtXA18C6sg3ji9zem4wpNyoz9m4UZT85mA2D2jx2gzEk",
];

let knownValidAddrs = [];
let knownInvalidAddrs = [];
const wsData = [];

async function startScan() {
  try {
    // Load the JSON files if they are available.
    const validFilename = "known-valid-addrs.json";
    const invalidFilename = "known-invalid-addrs.json";
    try {
      knownValidAddrs = await jsonFiles.readJSON(validFilename);
      console.log(`Successfully opened ${validFilename}`);
    } catch (err) {
      console.log(`Could not open ${validFilename}`);
    }
    try {
      knownInvalidAddrs = await jsonFiles.readJSON(invalidFilename);
      console.log(`Successfully opened ${invalidFilename}`);
    } catch (err) {
      console.log(`Could not open ${invalidFilename}`);
    }

    console.log(
      `Starting with ${knownValidAddrs.length} known valid wss peers.`
    );
    console.log(
      `Starting with ${knownInvalidAddrs.length} known invalid wss peers.\n`
    );

    // Use DHT routing and ipfs.io delegates.
    const ipfsOptions = {
      config: {
        Routing: {
          Type: "dhtclient",
        },
      },
      libp2p: {
        config: {
          dht: {
            enabled: true,
            clientMode: true,
          },
        },
      },
    };

    const ipfs = await IPFS.create(ipfsOptions);

    // Display config settings
    // const config = await ipfs.config.getAll();
    // console.log("config: ", config);

    console.log(" ");

    // Loop through list of bootstrap peers and connect to them.
    for (let i = 0; i < bootstrapMultiaddrs.length; i++) {
      const thisPeer = bootstrapMultiaddrs[i];

      try {
        await ipfs.swarm.connect(thisPeer);
        console.log(`Connected to ${thisPeer}`);
      } catch (err) {
        console.log(`Could not connect to ${thisPeer}`);
      }
    }

    let i = 0;

    do {
      i++;
      console.log(`\nIteration ${i}`);

      const now = new Date();
      console.log(`Timestamp: ${now.toLocaleString()}`);

      const peers = await ipfs.swarm.peers();
      console.log(`Connected to ${peers.length} peers.\n`);
      // console.log(`peers: ${JSON.stringify(peers, null, 2)}`);

      const connectedPeers = peers.map((elem) => elem.peer);
      // console.log('connectedPeers: ', connectedPeers)

      // Randomly select 25 peers.
      // let subsample = connectedPeers.concat([]);
      // if (subsample.length > 25) {
      //   subsample = getSubsamples(subsample);
      // }
      const subsample = getSubsamples(connectedPeers);
      // console.log(`subsample: ${JSON.stringify(subsample, null, 2)}`)

      const candidatePeers = [];

      // Loop through the known addresses
      for (let j = 0; j < subsample.length; j++) {
        // for (let j = 0; j < 2; j++) {
        const thisAddr = subsample[j];

        const nearbyPeers = [];

        // Find the nearby peers for current address.
        try {
          for await (const info of ipfs.dht.query(thisAddr)) {
            // console.log(info);
            nearbyPeers.push(info.id);
          }
        } catch (err) {
          /* exit quietly */
        }
        // console.log(
        //   `Peers near ${thisAddr}: ${JSON.stringify(nearbyPeers, null, 2)}`
        // )

        // Loop through each nearby peer for the current address.
        for (let k = 0; k < nearbyPeers.length; k++) {
          const thisPeer = nearbyPeers[k];

          const notInCandidateList = !candidatePeers.includes(thisPeer);
          const notInKnownValid = !knownValidAddrs.includes(thisPeer);
          const notInKnownInvalid = !knownInvalidAddrs.includes(thisPeer);

          // Add the peer to the candidate list if it doesn't already exist in
          // one of the other lists.
          if (notInCandidateList && notInKnownValid && notInKnownInvalid) {
            candidatePeers.push(thisPeer);
          }
        }

        const now = new Date();
        console.log(`DHT queried for ${thisAddr} at ${now.toLocaleString()}`);
      }
      // console.log(`Candidate Peers: ${JSON.stringify(candidatePeers, null, 2)}`)
      console.log(`Scanning ${candidatePeers.length} candidates.`);

      // Loop through each candidate address.
      for (let j = 0; j < candidatePeers.length; j++) {
        // for (let j = 0; j < 3; j++) {
        const thisCandidate = candidatePeers[j];
        // console.log('thisCandidate: ', thisCandidate)

        const info = await ipfs.dht.findPeer(thisCandidate);
        // console.log('info: ', info)

        const addrs = [];
        info.addrs.forEach((addr) => addrs.push(addr.toString()));
        // console.log("addrs: ", addrs);

        let wsFound = false;

        // try {
        //   await ipfs.swarm.connect(``)
        // }

        // Loop through each multiaddr string.
        for (let k = 0; k < addrs.length; k++) {
          const thisAddr = addrs[k];

          if (thisAddr.indexOf("/ws") > -1) {
            const obj = {
              addr: thisAddr,
              id: thisCandidate,
            };

            wsData.push(obj);

            if (!wsFound) {
              knownValidAddrs.push(thisCandidate);

              console.log(`WS peer found: ${thisCandidate}`);
              // break;
            }

            wsFound = true;
          }
        }

        // Add the candidate to the known-invalid array.
        if (!wsFound) {
          knownInvalidAddrs.push(thisCandidate);
          // console.log(`Added ${thisCandidate} to knownInvalidAddrs list`);
        }
      }

      console.log(`Known invalid addresses: ${knownInvalidAddrs.length}`);
      console.log(`Known valid addresses: ${knownValidAddrs.length}`);

      // Write results to the screen.
      // console.log(
      //   `knownInvalidAddrs: ${JSON.stringify(knownInvalidAddrs, null, 2)}`
      // );
      // console.log(`knownValidAddrs: ${JSON.stringify(knownValidAddrs, null, 2)}`);

      // Write results to the JSON files.
      await jsonFiles.writeJSON(knownInvalidAddrs, invalidFilename);
      await jsonFiles.writeJSON(knownValidAddrs, validFilename);
      await jsonFiles.writeJSON(wsData, "ws-peers.json");
      console.log(`Successfully wrote out new JSON files.\n`);
    } while (1);
  } catch (err) {
    console.error(err);
  }
}
startScan();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Given an array larger than 25 elements, it will return a 25 element array
// whos elements are randomly chosen from the input array.
function getSubsamples(inputArray) {
  try {
    // Combine all known peer IDs into a single array.
    const newArray = inputArray.concat(knownInvalidAddrs, knownValidAddrs);
    // console.log(`newArray: ${JSON.stringify(newArray, null, 2)}`)
    // console.log(`newArray length: ${newArray.length}`);

    const outArray = [];

    for (let i = 0; i < 20; i++) {
      const randIndex = Math.round(Math.random() * newArray.length);

      outArray.push(newArray[randIndex]);
    }
    // console.log(`outArray: ${JSON.stringify(outArray, null, 2)}`)

    return outArray;
  } catch (err) {
    console.error("Error in getSubsamples()");
    throw err;
  }
}
