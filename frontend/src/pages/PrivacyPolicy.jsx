import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div style={{ 
      padding: '40px 24px', 
      maxWidth: '800px', 
      margin: '0 auto', 
      fontFamily: 'var(--font-body)', 
      color: 'var(--text-primary)',
      minHeight: '100vh',
      background: 'var(--bg-primary)'
    }}>
      <Link to="/" style={{ 
        color: 'var(--green-600)', 
        textDecoration: 'none', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '32px',
        fontWeight: 600,
        fontSize: '14px'
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to Login
      </Link>
      
      <div style={{ 
        background: 'var(--card-bg)', 
        padding: '40px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <h1 style={{ 
          fontFamily: 'var(--font-display)', 
          fontSize: '36px', 
          marginBottom: '8px',
          color: 'var(--text-primary)'
        }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '14px' }}>Last updated: May 16, 2026</p>
        
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>1. Information We Collect</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            We collect information you provide directly to us when you create an account, such as your name, email address, and role (student, professor, or parent). We also collect data related to your academic activities within the platform to provide our core services.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>2. How We Use Your Information</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            We use the information we collect to:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '12px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            <li>Provide, maintain, and improve our services.</li>
            <li>Facilitate communication within the Bicol University Polangui community.</li>
            <li>Track academic progress and deadlines.</li>
            <li>Send important announcements and notifications.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>3. Data Security</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>4. Contact Us</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            If you have any questions about this Privacy Policy, please contact us at csb2023-7560-41163@bicol-u.edu.ph.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
