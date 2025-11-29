import React, { useState } from 'react';

const Help = () => {
  const [expandedFaq, setExpandedFaq] = useState(null);

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
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

  return (
    <main className="main">
      <section className="page">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0 }}>Help & Training</h2>
          </div>

          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Quick Guides</h3>
                <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--muted)' }}>
                  <li>How to register a patient</li>
                  <li>How to record vitals</li>
                  <li>How to create an encounter</li>
                  <li>How to use the inventory</li>
                  <li>How to generate reports</li>
                </ul>
              </div>

              <div className="card" style={{ marginTop: '12px' }}>
                <h3 style={{ marginTop: 0 }}>Video Demos</h3>
                <div style={{ color: 'var(--muted)' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Getting Started:</strong>{' '}
                    <a
                      href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#007bff',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      Overview of the EHR system (5 min)
                    </a>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Patient Management:</strong>{' '}
                    <a
                      href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#007bff',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      Register and update patient records (8 min)
                    </a>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Medical Encounters:</strong>{' '}
                    <a
                      href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#007bff',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      Creating and documenting visits (12 min)
                    </a>
                  </div>
                  <div>
                    <strong>Administration:</strong>{' '}
                    <a
                      href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#007bff',
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                    >
                      User management and settings (6 min)
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Contact Support</h3>
                <div style={{ color: 'var(--muted)', marginBottom: '8px' }}>
                  <strong>Email:</strong> support@tupclinic.edu.ph
                </div>
                <div style={{ color: 'var(--muted)', marginBottom: '8px' }}>
                  <strong>Phone:</strong> (02) 555-0123
                </div>
                <div style={{ color: 'var(--muted)', marginBottom: '8px' }}>
                  <strong>Hours:</strong> Monday - Friday, 8:00 AM - 5:00 PM
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  <strong>Live Chat:</strong> Available during business hours
                </div>
              </div>

              <div className="card" style={{ marginTop: '12px' }}>
                <h3 style={{ marginTop: 0 }}>Frequently Asked Questions</h3>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {faqs.map((faq, index) => (
                    <div key={index} style={{ border: '1px solid #f0f0f0', borderRadius: '4px', marginBottom: '8px' }}>
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
                          fontWeight: '500'
                        }}
                      >
                        {faq.question}
                        <span style={{
                          fontSize: '18px',
                          color: 'var(--muted)',
                          transition: 'transform 0.2s'
                        }}>
                          {expandedFaq === index ? '−' : '+'}
                        </span>
                      </button>
                      {expandedFaq === index && (
                        <div style={{
                          padding: '0 12px 12px 12px',
                          color: 'var(--muted)',
                          fontSize: '14px',
                          lineHeight: '1.5'
                        }}>
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Help;
