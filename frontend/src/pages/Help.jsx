import React, { useState } from 'react';

const Help = () => {
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [expandedGuide, setExpandedGuide] = useState(null);

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const toggleGuide = (index) => {
    setExpandedGuide(expandedGuide === index ? null : index);
  };

  const faqs = [
    {
      question: "How to reset my password?",
      answer: "To reset your password, click on your profile in the top right corner, select 'Settings', then choose 'Change Password'. Follow the instructions to set a new password."
    },
    {
      question: "What if I encounter an error?",
      answer: "If you encounter an error, first try refreshing the page. If the problem persists, take a screen capture and submit it to support@tupclinic.edu.ph with a description of what you were doing when the error occurred."
    },
    {
      question: "How to export patient data?",
      answer: "Patient data can be exported through the Reports page. Navigate to 'Reports', select your date range and criteria, then click 'Export CSV' or 'Export PDF' to download the patient data."
    },
    {
      question: "Who can access my patient records?",
      answer: "Patient records are only accessible to authorized medical staff (Physicians, Nurses) and administrators. All access is logged in the audit logs for privacy and security compliance."
    }
  ];

  const guides = [
    {
      title: "How to register a patient",
      content: "Visit the Patients page on the sidebar to register a patient. Click 'Register Patient', enter the patient details, and save the record."
    },
    {
      title: "How to record vitals",
      content: "Go to Encounters → Create New Encounter → choose a patient → record vitals. Save as draft or finalize the entry."
    },
    {
      title: "How to use the inventory",
      content: "Navigate to Inventory → Add Stock to increase items, or edit existing items by searching and updating their details."
    },
    {
      title: "How to generate reports",
      content: "Go to Reports → enter date range → click Run. Reports can be exported as CSV or PDF after generating."
    }
  ];

  return (
    <main className="main" style={{ minHeight: '100vh' }}>
      <section
        className="page"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '24px'
        }}
      >
        {/* Header card — uses .card so it follows light/dark theme */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Help & Training</div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* reserved for future header controls (search, submit ticket, etc.) */}
            </div>
          </div>

          <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>
            Find answers to common questions, step-by-step guides for clinic workflows, and contact details for support.
          </div>
        </div>

        {/* Main content grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '32px',
            alignItems: 'flex-start'
          }}
        >
          {/* FAQ Card — uses .card so theme is consistent */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>FAQs</h3>

            {faqs.map((faq, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid rgba(0,0,0,0.05)',
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  style={{
                    width: '100%',
                    padding: 12,
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text)',
                  }}
                >
                  {faq.question}
                  <span style={{ fontSize: 18, color: 'var(--muted)' }}>
                    {expandedFaq === index ? '−' : '+'}
                  </span>
                </button>

                {expandedFaq === index && (
                  <div style={{ padding: '0 12px 12px 12px', color: 'var(--muted)', fontSize: 14 }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Guides Card — also theme-aware */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>Quick Guides</h3>

            {guides.map((guide, index) => (
              <div key={index} style={{ border: '1px solid rgba(0,0,0,0.05)', borderRadius: 6, marginBottom: 8 }}>
                <button
                  onClick={() => toggleGuide(index)}
                  style={{
                    width: '100%',
                    padding: 12,
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text)',
                  }}
                >
                  {guide.title}
                  <span style={{ fontSize: 18, color: 'var(--muted)' }}>
                    {expandedGuide === index ? '−' : '+'}
                  </span>
                </button>

                {expandedGuide === index && (
                  <div style={{ padding: '0 12px 12px 12px', color: 'var(--muted)', fontSize: 14 }}>
                    {guide.content}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact Support — spans both columns; uses .card */}
          <div className="card" style={{ gridColumn: '1 / -1', padding: 28 }}>
            <h3 style={{ margin: 0, color: 'var(--accent)', fontWeight: 600 }}>Contact Support</h3>
            <div style={{ fontSize: 15, marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Phone:</strong> <a href="tel:+639127839134" style={{ color: 'var(--accent)' }}>(+63) 253 013 001</a>
              </div>
              <div>
                <strong>Hours:</strong> 8:00 AM – 5:00 PM
              </div>

              <div style={{ marginTop: 12, color: 'var(--muted)' }}>
                For technical issues, include a brief description, steps to reproduce, and a screenshot if possible when emailing tup@tup.edu.ph.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Help;
