import { useEffect, useState } from "react";
import api from "../../services/api/api";
import { Badge, Button, Card } from "../../components/ui";
import { PageHeader, PageLayout, Section } from "../../components/layout";

function Home() {
  const [backendStatus, setBackendStatus] = useState("Checking backend...");

  useEffect(() => {
    api
      .get("/health")
      .then((response) => {
        setBackendStatus(response.data.message);
      })
      .catch(() => {
        setBackendStatus("Backend connection failed");
      });
  }, []);

  return (
    <PageLayout>
      <PageHeader
        title="Home"
        subtitle="Quick overview of tours and enrollment activity."
        action={<Button>Add Tour</Button>}
      />

      <Section title="System Status">
        <Card padding="lg">
          <p style={{ margin: "0 0 12px", color: "#475569" }}>
            Backend connection
          </p>

          <Badge tone={backendStatus.includes("failed") ? "danger" : "success"}>
            {backendStatus}
          </Badge>
        </Card>
      </Section>
    </PageLayout>
  );
}

export default Home;