import { create } from "xmlbuilder2";

export function buildTxQueryXML(params: {
  terminalNumber: string;
  mid: string;
  txId: string;
}) {
  const { terminalNumber, mid, txId } = params;

  const query = {
    ashrait: {
      request: {
        requestId: "",
        version: "2000",
        language: "HEB",
        dateTime: "",
        command: "inquireTransactions",
        inquireTransactions: {
          terminalNumber,
          mainTerminalNumber: "",
          queryName: "mpiTransaction",
          mid,
          mpiTransactionId: txId,
        },
      },
    },
  };

  return create({ version: "1.0" })
    .ele(query)
    .end({ prettyPrint: true, headless: true });
}
