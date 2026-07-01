import { useEffect, useState } from "react";
import api from "../../services/api/api";

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
    <div>
      <h1>Home</h1>
      <p>{backendStatus}</p>
    </div>
  );
}

export default Home;