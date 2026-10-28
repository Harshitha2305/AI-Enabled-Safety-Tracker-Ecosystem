import { useEffect, useState } from "react";
import "./Profile.css";

const API_BASE = "/api/accounts/";

const emptyContact = {
  name: "",
  phone: "",
  relationship: "",
};

function Profile({ onBack }) {
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({});
  const [photo, setPhoto] = useState(null);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("authToken");

  const authHeaders = {
    Authorization: `Token ${localStorage.getItem("authToken")}`,
  };

  async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data.error ||
        Object.entries(data)
          .map(([key, value]) => {
            const detail = Array.isArray(value)
              ? value.join(" ")
              : typeof value === "string"
                ? value
                : JSON.stringify(value);
            return `${key}: ${detail}`;
          })
          .join("\n") ||
        "The request could not be completed.";

      throw new Error(message);
    }

    return data;
  }

  async function loadProfile() {
    const response = await fetch(`${API_BASE}profile/`, {
      headers: authHeaders,
    });

    return readResponse(response);
  }

  async function loadContacts() {
    const response = await fetch(`${API_BASE}emergency-contacts/`, {
      headers: authHeaders,
    });

    return readResponse(response);
  }

  async function loadPage() {
    setLoading(true);
    setError("");

    try {
      if (!token) {
        throw new Error("Your login session was not found. Please sign in again.");
      }

      const [profileData, contactData] = await Promise.all([
        loadProfile(),
        loadContacts(),
      ]);

      setProfile(profileData);
      setForm({
        full_name: profileData.full_name || "",
        phone: profileData.phone || "",
        address: profileData.address || "",
        date_of_birth: profileData.date_of_birth || "",
      });
      setContacts(contactData);
    } catch (err) {
      setError(err.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
    // Load once when the Profile page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function updateContactForm(event) {
    const { name, value } = event.target;
    setContactForm((previous) => ({ ...previous, [name]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSavingProfile(true);

    try {
      const body = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        body.append(key, value);
      });

      if (photo) {
        body.append("profile_photo", photo);
      }

      const response = await fetch(`${API_BASE}profile/`, {
        method: "PATCH",
        headers: authHeaders,
        body,
      });

      const updatedProfile = await readResponse(response);

      setProfile((previous) => ({ ...previous, ...updatedProfile }));
      setPhoto(null);
      setSuccess("Your profile has been updated successfully.");
    } catch (err) {
      setError(err.message || "Unable to update your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  function resetContactForm() {
    setContactForm(emptyContact);
    setEditingId(null);
  }

  async function saveContact(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSavingContact(true);

    try {
      const isEditing = editingId !== null;
      const url = isEditing
        ? `${API_BASE}emergency-contacts/${editingId}/`
        : `${API_BASE}emergency-contacts/`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contactForm),
      });

      const savedContact = await readResponse(response);

      if (isEditing) {
        setContacts((previous) =>
          previous.map((contact) =>
            contact.id === editingId ? savedContact : contact
          )
        );
        setSuccess("Emergency contact updated successfully.");
      } else {
        setContacts((previous) => [...previous, savedContact]);
        setSuccess("Emergency contact added successfully.");
      }

      resetContactForm();
    } catch (err) {
      setError(err.message || "Unable to save the emergency contact.");
    } finally {
      setSavingContact(false);
    }
  }

  function startEditing(contact) {
    setEditingId(contact.id);
    setContactForm({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
    });
    setError("");
    setSuccess("");
    document.getElementById("contact-editor")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  async function deleteContact(contactId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this emergency contact?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_BASE}emergency-contacts/${contactId}/`,
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        await readResponse(response);
      }

      setContacts((previous) =>
        previous.filter((contact) => contact.id !== contactId)
      );

      if (editingId === contactId) {
        resetContactForm();
      }

      setSuccess("Emergency contact deleted successfully.");
    } catch (err) {
      setError(err.message || "Unable to delete the contact.");
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Loading your profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="profile-card profile-load-error">
          <p className="profile-error">{error || "Unable to load your profile."}</p>
          <button className="profile-primary-button" onClick={loadPage}>
            Try again
          </button>
          {onBack && (
            <button className="profile-secondary-button" onClick={onBack}>
              Back to dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  const roleLabel = {
    user: "User / Child",
    parent: "Parent",
    volunteer: "Volunteer",
  }[profile.role] || profile.role;

  return (
    <main className="profile-page">
      <header className="profile-header">
        <div>
          <p className="profile-eyebrow">ACCOUNT SETTINGS</p>
          <h1>My Profile</h1>
          <p className="profile-header-subtitle">
            Manage your personal information and emergency contacts.
          </p>
        </div>

        {onBack && (
          <button className="profile-back-button" onClick={onBack}>
            ← Back to dashboard
          </button>
        )}
      </header>

      {error && (
        <div className="profile-message profile-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="profile-message profile-success" role="status">
          {success}
        </div>
      )}

      <section className="profile-card profile-identity-card">
        <div className="profile-avatar">
          {profile.profile_photo ? (
            <img
              src={profile.profile_photo}
              alt="Your profile"
            />
          ) : (
            <span>
              {(profile.full_name || profile.username || "U")
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
        </div>

        <div className="profile-identity-details">
          <h2>{profile.full_name || profile.username}</h2>
          <p>{profile.email}</p>
          <div className="profile-tags">
            <span className="profile-tag">{roleLabel}</span>
            <span
              className={`profile-tag ${
                profile.verification_status === "verified"
                  ? "profile-tag-verified"
                  : ""
              }`}
            >
              {String(profile.verification_status || "incomplete")
                .replaceAll("_", " ")}
            </span>
          </div>
        </div>
      </section>

      <section className="profile-card">
        <div className="profile-section-heading">
          <div>
            <h2>Personal information</h2>
            <p>Keep your contact details up to date.</p>
          </div>
        </div>

        <form className="profile-form" onSubmit={saveProfile}>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                value={profile.username || ""}
                disabled
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-email">Email address</label>
              <input
                id="profile-email"
                type="email"
                value={profile.email || ""}
                disabled
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-full-name">Full legal name</label>
              <input
                id="profile-full-name"
                name="full_name"
                value={form.full_name || ""}
                onChange={updateForm}
                required
                minLength={2}
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-phone">Mobile number</label>
              <input
                id="profile-phone"
                name="phone"
                type="tel"
                value={form.phone || ""}
                onChange={updateForm}
                required
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-dob">Date of birth</label>
              <input
                id="profile-dob"
                name="date_of_birth"
                type="date"
                value={form.date_of_birth || ""}
                onChange={updateForm}
                required
              />
            </div>

            <div className="profile-field profile-field-full">
              <label htmlFor="profile-address">Residential address</label>
              <textarea
                id="profile-address"
                name="address"
                value={form.address || ""}
                onChange={updateForm}
                rows={3}
                required
              />
            </div>

            <div className="profile-field profile-field-full">
              <label htmlFor="profile-photo">Change profile photo</label>
              <input
                id="profile-photo"
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(event) =>
                  setPhoto(event.target.files?.[0] || null)
                }
              />
              <small>JPG or PNG. Leave empty to keep your current photo.</small>
            </div>
          </div>

          <div className="profile-form-actions">
            <button
              type="submit"
              className="profile-primary-button"
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      <section className="profile-card">
        <div className="profile-section-heading">
          <div>
            <h2>Primary emergency contact</h2>
            <p>
              This is the contact you provided during registration.
              Additional contacts can be managed below.
            </p>
          </div>
        </div>

        {profile.emergency_contact_name || profile.emergency_contact_phone ? (
          <div className="profile-primary-contact">
            <div className="profile-contact-icon">★</div>
            <div>
              <h3>{profile.emergency_contact_name || "Primary contact"}</h3>
              <p>{profile.emergency_contact_phone || "No number provided"}</p>
              <span>
                {profile.emergency_contact_relationship || "Relationship not specified"}
              </span>
            </div>
          </div>
        ) : (
          <p className="profile-muted">
            No primary emergency contact is available on this profile.
          </p>
        )}
      </section>

      <section className="profile-card">
        <div className="profile-section-heading">
          <div>
            <h2>Additional emergency contacts</h2>
            <p>
              Add trusted people who may be contacted during an emergency.
            </p>
          </div>
          <span className="profile-count">{contacts.length} contacts</span>
        </div>

        {contacts.length === 0 ? (
          <div className="profile-empty">
            <div className="profile-empty-icon">＋</div>
            <h3>No additional contacts yet</h3>
            <p>Add a family member, friend, guardian, or another trusted person.</p>
          </div>
        ) : (
          <div className="profile-contact-list">
            {contacts.map((contact) => (
              <article className="profile-contact-item" key={contact.id}>
                <div className="profile-contact-icon">
                  {(contact.name || "C").charAt(0).toUpperCase()}
                </div>

                <div className="profile-contact-info">
                  <h3>{contact.name}</h3>
                  <p>{contact.phone}</p>
                  <span>{contact.relationship}</span>
                  <span
                    className={`profile-verification ${
                      contact.is_verified ? "is-verified" : ""
                    }`}
                  >
                    {contact.is_verified ? "Verified" : "Not verified"}
                  </span>
                </div>

                <div className="profile-contact-actions">
                  <button
                    type="button"
                    className="profile-small-button"
                    onClick={() => startEditing(contact)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="profile-small-button profile-delete-button"
                    onClick={() => deleteContact(contact.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="profile-contact-editor" id="contact-editor">
          <h3>
            {editingId !== null ? "Edit emergency contact" : "Add an emergency contact"}
          </h3>

          <form onSubmit={saveContact} className="profile-form">
            <div className="profile-form-grid">
              <div className="profile-field">
                <label htmlFor="contact-name">Contact full name</label>
                <input
                  id="contact-name"
                  name="name"
                  value={contactForm.name}
                  onChange={updateContactForm}
                  required
                  maxLength={150}
                />
              </div>

              <div className="profile-field">
                <label htmlFor="contact-phone">Mobile number</label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  value={contactForm.phone}
                  onChange={updateContactForm}
                  required
                  maxLength={20}
                />
              </div>

              <div className="profile-field profile-field-full">
                <label htmlFor="contact-relationship">Relationship</label>
                <select
                  id="contact-relationship"
                  name="relationship"
                  value={contactForm.relationship}
                  onChange={updateContactForm}
                  required
                >
                  <option value="">Select relationship</option>
                  <option value="Parent">Parent</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Friend">Friend</option>
                  <option value="Relative">Relative</option>
                  <option value="Child">Child</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="profile-form-actions">
              <button
                type="submit"
                className="profile-primary-button"
                disabled={savingContact}
              >
                {savingContact
                  ? "Saving..."
                  : editingId !== null
                    ? "Update contact"
                    : "Add contact"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  className="profile-secondary-button"
                  onClick={resetContactForm}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>

        <p className="profile-security-note">
          Contact numbers are stored with your account. A “Not verified” label
          means phone verification has not yet been implemented; it does not
          mean the contact has received a verification message.
        </p>
      </section>
    </main>
  );
}

export default Profile;
