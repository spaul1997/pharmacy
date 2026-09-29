import React from "react";
import { useParams } from "react-router-dom";
import { SalesList } from "../components/sales/SalesList.jsx";
import { SalesForm } from "../components/sales/SalesForm.jsx";
import { CustomerProfile } from "../components/sales/CustomerProfile.jsx";

function SalesLayout({ children }) {
  return <div className="min-w-0">{children}</div>;
}

export function SalesListPage({ entityKey }) {
  return (
    <SalesLayout>
      <SalesList entityKey={entityKey} />
    </SalesLayout>
  );
}

export function SalesFormPage({ entityKey, mode }) {
  const { id } = useParams();
  return (
    <SalesLayout>
      <SalesForm entityKey={entityKey} mode={mode} recordId={id} />
    </SalesLayout>
  );
}

export function CreateBillPage() {
  return (
    <SalesLayout>
      <SalesForm entityKey="sales-order" mode="create" presentation="bill" />
    </SalesLayout>
  );
}

export function CustomerProfilePage({ mode }) {
  const { id } = useParams();
  return (
    <SalesLayout>
      <CustomerProfile mode={mode} recordId={id} />
    </SalesLayout>
  );
}
