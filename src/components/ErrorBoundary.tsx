/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, { hasError: boolean }> {
  public override state = { hasError: false };

  public static getDerivedStateFromError() {
    return { hasError: false };
  }

  public override componentDidCatch(error: Error) {
    console.warn("[ErrorBoundary] Caught error:", error);
  }

  public override render() {
    return this.props.children;
  }
}
