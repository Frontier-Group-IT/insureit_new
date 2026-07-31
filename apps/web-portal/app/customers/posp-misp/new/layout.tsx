import type { ReactNode } from "react";
import { ConditionalGstField } from "./conditional-gst-field";

export default function NewIntermediaryApplicationLayout({children}:{children:ReactNode}){
 return <><ConditionalGstField/>{children}</>;
}
