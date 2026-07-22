import { api } from "./api";

export const getAppsheetSyncStatusRequest = () =>
  api.get("/sync/appsheet").then((res) => res.data.data.state);

export const runAppsheetSyncRequest = () =>
  api.post("/sync/appsheet").then((res) => res.data.data);
