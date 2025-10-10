import demoPayload from "../demo/demoPayload.json";
import { DashboardPage, type FetchPayload } from "./DashboardPage";

const demoData = demoPayload as FetchPayload;

export function DashboardDemoPage() {
  return <DashboardPage demoPayload={demoData} />;
}

export default DashboardDemoPage;
