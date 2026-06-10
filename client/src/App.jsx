import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CallProvider } from "./lib/CallContext.jsx";
import CommandView from "./pages/CommandView.jsx";
import Workspace from "./pages/Workspace.jsx";
import LeadQueue from "./pages/LeadQueue.jsx";
import PreCall from "./pages/PreCall.jsx";
import LiveCall from "./pages/LiveCall.jsx";
import PostCall from "./pages/PostCall.jsx";
import HandoverPacket from "./pages/HandoverPacket.jsx";

export default function App() {
  return (
    <CallProvider>
      <Routes>
        <Route path="/" element={<CommandView />} />
        <Route path="/w/:brandId" element={<Workspace />}>
          <Route index element={<Navigate to="leads" replace />} />
          <Route path="leads" element={<LeadQueue />} />
          <Route path="call/:leadId" element={<PreCall />} />
          <Route path="live" element={<LiveCall />} />
          <Route path="post/:callId" element={<PostCall />} />
          <Route path="handover/:callId" element={<HandoverPacket />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CallProvider>
  );
}
