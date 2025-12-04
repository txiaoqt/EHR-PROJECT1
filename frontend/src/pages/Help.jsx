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
    <main className="main" style={{ background: '#fafbfc', minHeight: '100vh' }}>
      <section
        className="page"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '40px 24px'
        }}
      >
        <h2 style={{ marginBottom: 32 }}>Help & Training</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '32px',
            alignItems: 'flex-start'
          }}
        >
          {/* FAQ Card */}
          <div
            className="card"
            style={{
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              padding: '24px'
            }}
          >
            <h3 style={{ marginTop: 0 }}>FAQs</h3>

            {faqs.map((faq, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: '6px',
                  marginBottom: '8px'
                }}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  {faq.question}
                  <span style={{ fontSize: '18px', color: 'var(--muted)' }}>
                    {expandedFaq === index ? '−' : '+'}
                  </span>
                </button>

                {expandedFaq === index && (
                  <div
                    style={{
                      padding: '0 12px 12px 12px',
                      color: 'var(--muted)',
                      fontSize: '14px'
                    }}
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Guides Card */}
          <div
            className="card"
            style={{
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              padding: '24px'
            }}
          >
            <h3 style={{ marginTop: 0 }}>Quick Guides</h3>

            {guides.map((guide, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: '6px',
                  marginBottom: '8px'
                }}
              >
                <button
                  onClick={() => toggleGuide(index)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  {guide.title}
                  <span style={{ fontSize: '18px', color: 'var(--muted)' }}>
                    {expandedGuide === index ? '−' : '+'}
                  </span>
                </button>

                {expandedGuide === index && (
                  <div
                    style={{
                      padding: '0 12px 12px 12px',
                      color: 'var(--muted)',
                      fontSize: '14px'
                    }}
                  >
                    {guide.content}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact Support - spans both columns */}
          <div
            className="card"
            style={{
              gridColumn: '1 / -1',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              padding: '28px 22px',
              minHeight: '100px'
            }}
          >
            <h3 style={{ margin: 0, color: '#1976d2', fontWeight: 600 }}>Contact Support</h3>
            <div style={{ fontSize: '15px', marginTop: '12px' }}>            
              <div style={{ marginBottom: '8px' }}>
                <strong>Phone:</strong> <a href="tel:+6323027750" style={{ color: '#1976d2' }}>(02) 302‑7750</a>
              </div>
              <div>
                <strong>Hours:</strong> 8:00 AM – 5:00 PM
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Help;
