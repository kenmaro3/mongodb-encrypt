const { MongoClient, Binary } = require("mongodb");
const { ClientEncryption } = require("mongodb-client-encryption");

const eDB = "encryption";
const eKV = "__keyVault";
const keyVaultNamespace = `${eDB}.${eKV}`;
const secretDB = "Cluster0";
const secretCollection = "patients";

// start-kmsproviders
const provider = "aws";
const kmsProviders = {
  aws: {
    accessKeyId: "xxxxxxxxx",
    secretAccessKey: "yyyyyyyyyyyyy",
  },
};
// end-kmsproviders
// end-kmsproviders

// start-datakeyopts
const masterKey = {
  key: "xxxxxxxxxxx",
  region: "us-west-1",
};
// end-datakeyopts

async function run() {
  // start-create-index
  const uri =  "mongodb+srv://xxxxxx:yyyyyyyyyy@zzzzzzz.zzzzz.mongodb.net/?retryWrites=true&w=majority";
  const keyVaultClient = new MongoClient(uri);
  const keyDB = keyVaultClient.db(eDB);
  await keyDB.dropDatabase();
  await keyVaultClient.connect();
  const keyVaultColl = keyVaultClient.db(eDB).collection(eKV);
  await keyVaultColl.createIndex(
   { keyAltNames: 1 },
   {
     unique: true,
     partialFilterExpression: { keyAltNames: { $exists: true } },
   }
  );
  // end-create-index
  // start-create-dek
  const clientEnc = new ClientEncryption(keyVaultClient, {
    keyVaultNamespace: keyVaultNamespace,
    kmsProviders: kmsProviders,
  });
  const dek1 = await clientEnc.createDataKey(provider, {
    masterKey: masterKey,
    keyAltNames: ["dataKey1"],
  });
  const dek2 = await clientEnc.createDataKey(provider, {
    masterKey: masterKey,
    keyAltNames: ["dataKey2"],
  });
  const dek3 = await clientEnc.createDataKey(provider, {
    masterKey: masterKey,
    keyAltNames: ["dataKey3"],
  });
  const dek4 = await clientEnc.createDataKey(provider, {
    masterKey: masterKey,
    keyAltNames: ["dataKey4"],
  });
  // end-create-dek

  // start-create-enc-collection
  const encryptedFieldsMap = {
    [`${secretDB}.${secretCollection}`]: {
      fields: [
        {
          keyId: dek1,
          path: "phoneNumber",
          bsonType: "string",
          queries: { queryType: "equality" },
        },
        {
          keyId: dek2,
          path: "medications",
          bsonType: "array",
        },
        {
          keyId: dek3,
          path: "patientRecord.ssn",
          bsonType: "string",
          queries: { queryType: "equality" },
        },
        {
          keyId: dek4,
          path: "patientRecord.billing",
          bsonType: "object",
        },
      ],
    },
  };
  const extraOptions = {
    cryptSharedLibPath: "/Users/xxxx/Downloads/tmp_lib/lib/mongo_crypt_v1.dylib",
    cryptSharedRequired: true,
  };
  const encClient = new MongoClient(uri, {
    autoEncryption: {
      keyVaultNamespace,
      kmsProviders,
      extraOptions,
      encryptedFieldsMap,
    },

  });

  await encClient.connect();
  const newEncDB = encClient.db(secretDB);
  await newEncDB.dropDatabase();
  await newEncDB.createCollection(secretCollection);
  await keyVaultClient.close();
  await encClient.close();
}

run().catch(console.dir);
