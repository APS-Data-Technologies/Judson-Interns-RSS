import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui";
import "./TourPlaceholder.css";

function TourPlaceholder({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === "edit";

  return (
    <section className="tour-placeholder-page">
      <div className="tour-placeholder-card">
        <p>Tour #{id}</p>
        <h1>{isEdit ? "Edit Tour" : "Tour Details"}</h1>
        <span>
          {isEdit
            ? "Edit tour content will be built here."
            : "Tour detail content will be built here."}
        </span>
        <div className="tour-placeholder-actions">
          <Button type="button" onClick={() => navigate("/tours")}>
            Back to Tours
          </Button>
          {!isEdit && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/tours/${id}/edit`)}
            >
              Edit Tour
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export default TourPlaceholder;
