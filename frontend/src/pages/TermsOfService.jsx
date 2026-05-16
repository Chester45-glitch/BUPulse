import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
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
        }}>Terms of Service</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '14px' }}>Last updated: May 16, 2026</p>
        
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>1. Acceptance of Terms</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            By accessing or using BUPulse, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>2. Use of the Service</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            BUPulse is an academic platform designed for the Bicol University Polangui community. You must be an authorized student, professor, or parent to access the service. You are responsible for maintaining the confidentiality of your account.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>3. Prohibited Conduct</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            You agree not to:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '12px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            <li>Use the service for any illegal purpose.</li>
            <li>Post any content that is defamatory, obscene, or infringing on intellectual property rights.</li>
            <li>Attempt to gain unauthorized access to any part of the service.</li>
            <li>Interfere with or disrupt the service or servers.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>4. Termination</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            We reserve the right to terminate or suspend your access to the service at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users of the service, us, or third parties, or for any other reason.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>5. Changes to Terms</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            We may modify these Terms of Service at any time. Your continued use of the service after such modifications will constitute your acknowledgment and acceptance of the modified Terms.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
