import React, { useEffect, useState } from "react";
import PeopleDetails from "./PeopleDetails";
import CompanyDetails from "./CompanyDetails";
// import SalesDetails from "./SalesDetails";
import VerificationDetails from "../production/verification/VerificationDetails";
import ApplicationDetails from "../production/verification/ApplicationDetails";
import ApplicantDetails from "../recruiting/ApplicantDetails";
import PipelineChecklistDetails from "../recruiting/Pipeline/PipelineChecklistDetails";
import "./RightDetails.css";

// Default columns for company details if none are provided
const defaultCompanyColumns = [
  {
    Header: "Status",
    accessor: "status",
    DropdownOptions: [
      "New",
      "Active",
      "Inactive"
    ]
  },
  {
    Header: "Name",
    accessor: "name"
  },
  {
    Header: "Website",
    accessor: "website"
  },
  {
    Header: "Industry",
    accessor: "industry"
  },
  {
    Header: "Revenue",
    accessor: "revenue"
  },
  {
    Header: "Employee Count",
    accessor: "employee_count"
  },
  {
    Header: "Phone",
    accessor: "phone"
  },
  {
    Header: "Email",
    accessor: "email"
  },
  {
    Header: "Notes",
    accessor: "notes"
  },
  {
    Header: "Address",
    accessor: "address"
  }
];

const RightDetails = (props) => {
  const { fromPage, data, onSave, onClose } = props;
  const [isOpen, setIsOpen] = useState(false);
  
  // Log which component will be rendered
  console.log("RightDetails rendering with fromPage:", fromPage);
  console.log("RightDetails data:", data);
  
  // Animation effect - slide in when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 10); // Small delay to ensure proper animation
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle close with animation
  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300); // Wait for animation to complete
  };
  
  // Prepare a safe onSave handler that won't cause issues
  const handleSave = async (result) => {
    console.log("RightDetails.handleSave called with:", result);
    if (onSave) {
      try {
        return await onSave(result);
      } catch (error) {
        console.error("Error in RightDetails.handleSave:", error);
        return false;
      }
    }
    return true;
  };
  
  // Common props for all detail components
  const detailProps = {
    ...props,
    onSave: handleSave,
    onClose: handleClose
  };

  // Determine which component to render
  let DetailComponent;
  let detailData = data;
  let detailFromPage = fromPage;

  // Check for our special verification flag
  const isVerificationData = data && data.__isVerificationDetails === true;
  if (isVerificationData) {
    console.log("Detected verification data via flag, rendering VerificationDetails component");
    const { __isVerificationDetails, ...cleanData } = data;
    DetailComponent = VerificationDetails;
    detailData = cleanData;
    detailFromPage = "Verification";
  }
  // Check for our special application details flag  
  else if (data && data.__isApplicationDetails === true) {
    console.log("Detected application details data via flag, rendering ApplicationDetails component");
    DetailComponent = ApplicationDetails;
    // Pass the verification data as the row prop, not the entire data object
    detailData = data.verificationData;
    detailFromPage = "Verification";
  }
  // Check for our special company flag  
  else if (data && data.__isCompanyDetails === true) {
    console.log("Detected company data via flag, rendering CompanyDetails component");
    const { __isCompanyDetails, ...cleanData } = data;
    DetailComponent = CompanyDetails;
    detailData = cleanData;
    detailFromPage = "Company";
    detailProps.columns = defaultCompanyColumns;
  }
  // Check for our special person flag
  else if (data && data.__isPersonDetails === true) {
    console.log("Detected person data via flag, rendering PeopleDetails component");
    const { __isPersonDetails, ...cleanData } = data;
    DetailComponent = PeopleDetails;
    detailData = cleanData;
    detailFromPage = "People";
  }
  // Check for our special applicant flag
  else if (data && data.__isApplicantDetails === true) {
    console.log("Detected applicant data via flag, rendering ApplicantDetails component");
    const { __isApplicantDetails, ...cleanData } = data;
    DetailComponent = ApplicantDetails;
    detailData = cleanData;
    detailFromPage = "Applicants";
    
    // Add action handler props for ApplicantDetails
    detailProps.onQuickAction = props.onQuickAction;
    detailProps.onMoveToApplicants = props.onMoveToApplicants;
    detailProps.onAdvanceStep = props.onAdvanceStep;
    detailProps.onShowFinalModal = props.onShowFinalModal;
    detailProps.onShowCallbackModal = props.onShowCallbackModal;
    detailProps.onShowHiredModal = props.onShowHiredModal;
  }
  // Check for our special pipeline checklist flag
  else if (data && data.__isPipelineChecklist === true) {
    console.log("Detected pipeline checklist data via flag, rendering PipelineChecklistDetails component");
    const { __isPipelineChecklist, ...cleanData } = data;
    DetailComponent = PipelineChecklistDetails;
    detailData = cleanData;
    detailFromPage = "Pipeline";
  }
  // Force the use of SalesDetails if the data appears to be a sale record
  // else if (data && (data.fromPage === "Sales" || (data.transaction_date && data.total_amount !== undefined))) {
  //   console.log("Detected sales data, rendering SalesDetails component");
  //   DetailComponent = SalesDetails;
  //   detailFromPage = "Sales";
  // }
  else if (fromPage === "Company") {
    console.log("Rendering CompanyDetails component");
    DetailComponent = CompanyDetails;
    detailProps.columns = defaultCompanyColumns;
  }
  // else if (fromPage === "Sales") {
  //   console.log("Rendering SalesDetails component");
  //   DetailComponent = SalesDetails;
  // }
  else if (fromPage === "Verification") {
    console.log("Rendering VerificationDetails component");
    DetailComponent = VerificationDetails;
  }
  else {
    console.log("Rendering PeopleDetails component (default)");
    DetailComponent = PeopleDetails;
  }

  // Determine if this is a verification form
  const isVerificationForm = isVerificationData || (data && data.__isApplicationDetails === true) || fromPage === "Verification";
  
  return (
    <>
      {/* Overlay - hidden for verification forms */}
      {!isVerificationForm && (
        <div 
          className={`right-details-overlay ${isOpen ? 'open' : ''}`}
          onClick={handleClose}
        />
      )}
      
      {/* Right Panel */}
      <div className={`right-details-container ${isOpen ? 'open' : ''} ${isVerificationForm ? 'verification-form' : ''}`}>
        <DetailComponent
          {...detailProps}
          data={detailData}
          fromPage={detailFromPage}
        />
      </div>
    </>
  );
};

export default RightDetails; 