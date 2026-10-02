import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const DESIGNATED_AGENT = {
  name: 'Thomas Kim',
  email: 'thomashkim7@gmail.com',
  address: '1111 Parsippany Blvd Parsippany NJ 07054',
};

type Status = 'idle' | 'submitting' | 'success' | 'error';

const Dmca: React.FC = () => {
  const [form, setForm] = useState({
    claimantName: '',
    claimantEmail: '',
    claimantAddress: '',
    infringingUrl: '',
    originalWork: '',
    swornStatement: false,
  });
  const [status, setStatus] = useState<Status>('idle');
  const [noticeId, setNoticeId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.swornStatement) {
      setErrorMsg('You must check the sworn statement to submit.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('dmca-takedown', {
        body: form,
      });
      if (error) throw error;
      setNoticeId(data?.noticeId ?? null);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setErrorMsg('Submission failed. Please email ' + DESIGNATED_AGENT.email + ' directly.');
      setStatus('error');
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-dark-800 border border-white/10 text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors text-sm';
  const labelClass = 'block text-sm font-medium text-dark-300 mb-1';

  return (
    <div className="min-h-full px-4 py-10 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-black font-kyobo">DMCA Takedown Policy</h1>
        <p className="mt-2 text-dark-400 text-sm">
          Sypher respects intellectual property rights and complies with the Digital Millennium
          Copyright Act (17 U.S.C. § 512). If you believe content on Sypher infringes your
          copyright, submit a notice below.
        </p>
      </div>

      {/* Designated Agent */}
      <section className="rounded-2xl bg-dark-800 border border-white/10 p-6 space-y-2">
        <p className="text-lg font-semibold text-black">Designated Copyright Agent</p>
        <p className="text-dark-400 text-sm">
          Notices must be sent to our registered DMCA agent:
        </p>
        <ul className="text-sm text-dark-300 space-y-1 mt-2">
          <li><span className="text-black font-medium">Name:</span> {DESIGNATED_AGENT.name}</li>
          <li><span className="text-black font-medium">Email:</span> {DESIGNATED_AGENT.email}</li>
          <li><span className="text-black font-medium">Address:</span> {DESIGNATED_AGENT.address}</li>
        </ul>
      </section>

      {/* What you need to include */}
      <section className="rounded-2xl bg-dark-800 border border-white/10 p-6 space-y-3">
        <p className="text-lg font-semibold text-black">What your notice must include</p>
        <p className="text-dark-400 text-sm">Per 17 U.S.C. § 512(c)(3), a valid DMCA notice must contain:</p>
        <ol className="list-decimal list-inside text-sm text-dark-300 space-y-1.5 ml-1">
          <li>Your physical or electronic signature (your full name serves as signature here)</li>
          <li>Identification of the copyrighted work you claim has been infringed</li>
          <li>The URL of the allegedly infringing content on Sypher</li>
          <li>Your contact information (name, address, email)</li>
          <li>A statement that you have a good faith belief the use is not authorized</li>
          <li>A statement, under penalty of perjury, that the information is accurate and you are the rights holder (or authorized to act on their behalf)</li>
        </ol>
      </section>

      {/* Takedown form */}
      {status === 'success' ? (
        <div className="rounded-2xl bg-emerald-900/30 border border-emerald-500/30 p-8 text-center space-y-3">
          <div className="text-4xl">✓</div>
          <p className="text-xl font-bold text-black">Notice Received</p>
          <p className="text-dark-300 text-sm">
            We've received your DMCA notice and will act on it within 24 hours.
            {noticeId && <> Your reference ID is <span className="text-black font-mono">{noticeId}</span>.</>}
          </p>
          <p className="text-dark-400 text-xs">
            If a matching track was found, it has already been removed from public listings.
            The uploader has been notified and has the right to file a counter-notice.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-dark-800 border border-white/10 p-6 space-y-5">
          <p className="text-lg font-semibold text-black">Submit a Takedown Notice</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Your Full Name *</label>
              <input
                type="text"
                required
                className={inputClass}
                placeholder="Jane Smith"
                value={form.claimantName}
                onChange={(e) => set('claimantName', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Your Email *</label>
              <input
                type="email"
                required
                className={inputClass}
                placeholder="jane@example.com"
                value={form.claimantEmail}
                onChange={(e) => set('claimantEmail', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Mailing Address</label>
            <input
              type="text"
              className={inputClass}
              placeholder="123 Main St, City, State, ZIP, Country"
              value={form.claimantAddress}
              onChange={(e) => set('claimantAddress', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>URL of Infringing Content on Sypher *</label>
            <input
              type="url"
              required
              className={inputClass}
              placeholder="https://sypher.app/..."
              value={form.infringingUrl}
              onChange={(e) => set('infringingUrl', e.target.value)}
            />
            <p className="text-xs text-dark-500 mt-1">Paste the direct link to the track or profile page.</p>
          </div>

          <div>
            <label className={labelClass}>Description of the Original Copyrighted Work *</label>
            <textarea
              required
              rows={3}
              className={inputClass + ' resize-none'}
              placeholder="e.g. 'My original song titled X, released on Y label, available at Z'"
              value={form.originalWork}
              onChange={(e) => set('originalWork', e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-dark-700 border border-white/10">
            <input
              id="sworn"
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-primary-500 flex-shrink-0"
              checked={form.swornStatement}
              onChange={(e) => set('swornStatement', e.target.checked)}
            />
            <label htmlFor="sworn" className="text-xs text-dark-300 leading-relaxed cursor-pointer">
              I have a good faith belief that the use of the copyrighted material described above
              is not authorized by the copyright owner, its agent, or the law. I swear, under
              penalty of perjury, that the information in this notification is accurate and that
              I am the copyright owner or authorized to act on the copyright owner's behalf.
              <span className="text-red-400"> *</span>
            </label>
          </div>

          {errorMsg && (
            <p className="text-sm text-red-400">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-black font-semibold transition-colors disabled:opacity-50"
          >
            {status === 'submitting' ? 'Submitting…' : 'Submit DMCA Notice'}
          </button>

          <p className="text-xs text-dark-500 text-center">
            False DMCA claims are subject to liability under 17 U.S.C. § 512(f).
            Misuse of this form may result in legal action against you.
          </p>
        </form>
      )}

      {/* Counter-notice info */}
      <section className="rounded-2xl bg-dark-800 border border-white/10 p-6 space-y-3">
        <p className="text-lg font-semibold text-black">Counter-Notice</p>
        <p className="text-dark-400 text-sm">
          If your content was removed and you believe it was a mistake, you may submit a
          counter-notice to <a href={`mailto:${DESIGNATED_AGENT.email}`} className="text-primary-400 underline">{DESIGNATED_AGENT.email}</a> with:
        </p>
        <ol className="list-decimal list-inside text-sm text-dark-300 space-y-1.5 ml-1">
          <li>Your full name, address, and email</li>
          <li>Identification of the removed content and its URL before removal</li>
          <li>A statement under penalty of perjury that the removal was a mistake or misidentification</li>
          <li>Consent to jurisdiction of the federal court in your district</li>
        </ol>
        <p className="text-dark-500 text-xs">
          Upon receiving a valid counter-notice, we will forward it to the claimant. If they do
          not file a court action within 10–14 business days, we may restore the content.
        </p>
      </section>

    </div>
  );
};

export default Dmca;
