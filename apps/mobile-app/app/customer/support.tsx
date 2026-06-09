import { Card, Row, Screen } from '@/components/ui';

export default function SupportScreen() {
  return (
    <Screen title="Support / Contact" subtitle="Our team can help with claim documents, status questions, and next steps." showLogout>
      <Card>
        <Row label="Phone" value="Contact your assigned InsureIt representative" />
        <Row label="Email" value="Use your registered support contact" />
        <Row label="Hours" value="Monday to Saturday, business hours" />
      </Card>
    </Screen>
  );
}
