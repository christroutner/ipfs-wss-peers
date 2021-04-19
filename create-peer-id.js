/*
  Tries to create a peer ID from a number.
*/

const PeerId = require("peer-id");

async function start() {
  const hex =
    "1220af21ac09c69494a4b0ee12ad7489f469a3d39fe4bc17dfd43d83a5d596cbe18e";

  // Conver the hex string into a base-10 number.
  const num = parseInt(hex, 16);

  for (let i = 0; i < 3; i++) {
    const newNum = num + i;
    console.log('newNum: ', newNum)

    const newHex = newNum.toString(16);
    console.log('newHex: ', newHex)

    const id = PeerId.createFromHexString(newHex);
    console.log(JSON.stringify(id.toJSON(), null, 2));
  }
}
start();

// Generate a new ID. Also display it as a hex string.
async function generateId() {
  try {
    const id = await PeerId.create({ bits: 1024, keyType: "RSA" });
    console.log(JSON.stringify(id.toJSON(), null, 2));

    const hex = id.toHexString();
    console.log("hex: ", hex);
  } catch (err) {
    console.error(err);
  }
}
