import React from "react";

export const PrometheusLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <img src="/prometheus-logo.png" width={size} height={size} alt="Prometheus" style={{ display: "block" }} />
);
