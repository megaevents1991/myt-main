import { create } from "xmlbuilder2";

export function buildDoDealXML(params: {
  terminalNumber: string;
  mid: string;
  uniqueid: string;
  total: number;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
  email: string;
}) {
  const {
    terminalNumber,
    mid,
    uniqueid,
    total,
    successUrl,
    errorUrl,
    cancelUrl
  } = params;
  const doc = create()
    .ele("ashrait")
    .ele("request")
    .ele("version")
    .txt("2000")
    .up()
    .ele("language")
    .txt("HEB")
    .up()
    .ele("dateTime")
    .up()
    .ele("command")
    .txt("doDeal")
    .up()
    .ele("requestid")
    .txt(uniqueid)
    .up()
    .ele("doDeal")
    .ele("terminalNumber")
    .txt(terminalNumber)
    .up()
    .ele("cardNo")
    .txt("CGMPI")
    .up()
    .ele("successUrl")
    .txt(successUrl)
    .up()
    .ele("errorUrl")
    .txt(errorUrl)
    .up()
    .ele("cancelUrl")
    .txt(cancelUrl)
    .up()
    .ele("total")
    .txt(total.toString())
    .up()
    .ele("transactionType")
    .txt("Debit")
    .up()
    .ele("creditType")
    .txt("Payments")
    .up()
    .ele("currency")
    .txt("ILS")
    .up()
    .ele("transactionCode")
    .txt("Internet")
    .up()
    .ele("numberOfPayments")
    .txt("5")
    .up()
    .ele("validation")
    .txt("TxnSetup")
    .up()
    .ele("mid")
    .txt(mid)
    .up()
    .ele("uniqueid")
    .txt(uniqueid)
    .up()
    .ele("mpiValidation")
    .txt("AutoComm")
    .up()
    .ele("paymentPageData")
    .ele("ppsJSONConfig")
    .txt(JSON.stringify({
		 "uiCustomData": {
		   "uiLang": "heb",
		   "keepCCDetails": false,
		   "skipPaymentMethodsScreen": false,
		   "disableRetryOnFailure": false,
		   "disableTxnRedirectPopup": false,
		   "inputPlaceholder": false,
		   "customStyle": "",
		   "customText": {
			  "label-card-number": "מספר כרטיס (לא מכבדים דיינרס)"
		   },
		   "userData": []
		 }
		}))
    .up()
    .up()
    .up()
    .up()
    .up();

  return doc.end({ prettyPrint: true, headless: true });
}