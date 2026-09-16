import type { FiscalSourceProfile } from "../shared/fiscal-source-profiles";
import type { FiscalParserResult } from "./fiscal-parser-types";
import { parseMajorMeasures2024 } from "./parse-major-measures-2024";
import { parseSettlementOverview2024 } from "./parse-settlement-overview-2024";

export function parseFiscalDocument(params: {
  profile: FiscalSourceProfile;
  text: string;
}): FiscalParserResult {
  switch (params.profile.parserKind) {
    case "metadata_only":
      return { records: [], validationSummary: [] };
    case "settlement_overview_2024":
      return parseSettlementOverview2024(params.text);
    case "major_measures_2024":
      return parseMajorMeasures2024(params.text);
  }
}
