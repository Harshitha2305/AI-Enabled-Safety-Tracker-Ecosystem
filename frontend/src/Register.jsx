
import { useState } from "react";
import "./Register.css";

export default function Register({ onRegistered, onShowLogin }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    full_name: "",
    phone: "",
    address: "",
    date_of_birth: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
  });

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [identityDocument, setIdentityDocument] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!profilePhoto || !identityDocument) {
      setError("Please upload your profile photo and identity document.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });

      formData.append("profile_photo", profilePhoto);
      formData.append("identity_document", identityDocument);

      const response = await fetch("/api/accounts/register/", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = Object.entries(data)
          .map(([field, errors]) => {
            const details = Array.isArray(errors)
              ? errors.join(" ")
              : typeof errors === "string"
                ? errors
                : JSON.stringify(errors);

            return `${field}: ${details}`;
          })
          .join("\n");

        throw new Error(message || "Registration failed.");
      }

      setSuccess(
        "Registration submitted successfully. Your account is pending verification. You can sign in after the verification process allows access."
      );

      setForm({
        username: "",
        email: "",
        password: "",
        role: "user",
        full_name: "",
        phone: "",
        address: "",
        date_of_birth: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        emergency_contact_relationship: "",
      });

      setProfilePhoto(null);
      setIdentityDocument(null);

      event.target.reset();

      if (onRegistered) {
        onRegistered(data);
      }
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <section className="register-visual">
        <div className="register-brand">
          <span className="register-brand-icon">✳</span>
          <span>
            SAFEGUARD<span className="register-brand-dot">.</span>
          </span>
        </div>

        <div className="register-visual-content">
          <span className="register-eyebrow">
            INTELLIGENT SAFETY SYSTEM
          </span>

          <h1>
            Protection starts with <span>connection.</span>
          </h1>

          <p>
            Create your account to connect with your safety network,
            monitor emergencies, and help protect the people who matter.
          </p>

          <div className="register-feature">
            <span>✓</span>
            <div>
              <strong>Connected safety</strong>
              <p>Emergency alerts and coordinated response.</p>
            </div>
          </div>

          <div className="register-feature">
            <span>✓</span>
            <div>
              <strong>Family connection</strong>
              <p>Parents can link to their child's account securely.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="register-form-side">
        <div className="register-form-wrap">
          <p className="register-kicker">GET STARTED</p>
          <h2>Create your account</h2>

          <p className="register-subtitle">
            All fields marked * are required for every account type.
          </p>

          <form onSubmit={handleSubmit} encType="multipart/form-data">
            <h3>Account details</h3>

            <label htmlFor="reg-username">Username *</label>
            <input
              id="reg-username"
              name="username"
              value={form.username}
              onChange={updateField}
              autoComplete="username"
              required
            />

            <label htmlFor="reg-email">Email address *</label>
            <input
              id="reg-email"
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              autoComplete="email"
              required
            />

            <label htmlFor="reg-password">Password *</label>
            <div className="register-password-wrap">
              <input
                id="reg-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={updateField}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <label htmlFor="reg-role">Account type *</label>
            <select
              id="reg-role"
              name="role"
              value={form.role}
              onChange={updateField}
              required
            >
              <option value="user">User</option>
              <option value="parent">Parent</option>
              <option value="volunteer">Volunteer</option>
            </select>

            <h3>Personal information</h3>

            <label htmlFor="reg-full-name">Full legal name *</label>
            <input
              id="reg-full-name"
              name="full_name"
              value={form.full_name}
              onChange={updateField}
              autoComplete="name"
              required
            />

            <label htmlFor="reg-phone">Mobile number *</label>
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={updateField}
              autoComplete="tel"
              placeholder="Enter your mobile number"
              required
            />

            <label htmlFor="reg-dob">Date of birth *</label>
            <input
              id="reg-dob"
              name="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={updateField}
              max={new Date().toISOString().split("T")[0]}
              required
            />

            <label htmlFor="reg-address">Residential address *</label>
            <textarea
              id="reg-address"
              name="address"
              value={form.address}
              onChange={updateField}
              rows={3}
              placeholder="Enter your full address"
              autoComplete="street-address"
              required
            />

            <label htmlFor="reg-photo">Profile photo (JPG or PNG) *</label>
            <input
              id="reg-photo"
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={(event) =>
                setProfilePhoto(event.target.files?.[0] || null)
              }
              required
            />
            {profilePhoto && (
              <p className="register-info">
                Selected: {profilePhoto.name}
              </p>
            )}

            <label htmlFor="reg-identity">
              Identity verification document (PDF, JPG or PNG) *
            </label>
            <input
              id="reg-identity"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) =>
                setIdentityDocument(event.target.files?.[0] || null)
              }
              required
            />
            {identityDocument && (
              <p className="register-info">
                Selected: {identityDocument.name}
              </p>
            )}

            <h3>Emergency contact</h3>

            <label htmlFor="reg-contact-name">
              Contact full name *
            </label>
            <input
              id="reg-contact-name"
              name="emergency_contact_name"
              value={form.emergency_contact_name}
              onChange={updateField}
              required
            />

            <label htmlFor="reg-contact-phone">
              Contact mobile number *
            </label>
            <input
              id="reg-contact-phone"
              name="emergency_contact_phone"
              type="tel"
              value={form.emergency_contact_phone}
              onChange={updateField}
              required
            />

            <label htmlFor="reg-contact-relationship">
              Relationship to you *
            </label>
            <select
              id="reg-contact-relationship"
              name="emergency_contact_relationship"
              value={form.emergency_contact_relationship}
              onChange={updateField}
              required
            >
              <option value="">Select relationship</option>
              <option value="Parent">Parent</option>
              <option value="Spouse">Spouse</option>
              <option value="Sibling">Sibling</option>
              <option value="Friend">Friend</option>
              <option value="Relative">Relative</option>
              <option value="Guardian">Guardian</option>
              <option value="Other">Other</option>
            </select>

            {form.role === "volunteer" && (
              <p className="register-info">
                Volunteer accounts require additional application review
                and administrator approval before accessing the volunteer
                dashboard.
              </p>
            )}

            {form.role === "parent" && (
              <p className="register-info">
                After linking your child's account, you can monitor their
                available location and receive emergency alerts.
              </p>
            )}

            {form.role === "user" && (
              <p className="register-info">
                Your parent can link to your account using the temporary
                pairing code generated after signing in, when applicable.
              </p>
            )}

            {error && (
              <div className="register-error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="register-success" role="status">
                {success}
              </div>
            )}

            <button
              className="register-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Submitting registration..." : "Create account"}
              {!loading && <span>→</span>}
            </button>
          </form>

          <p className="register-login-prompt">
            Already have an account?
            <button type="button" onClick={onShowLogin}>
              Sign in
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
