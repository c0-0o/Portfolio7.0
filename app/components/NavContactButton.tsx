"use client";

import Button from "@/components/Button";

const CONTACT_EMAIL = "mailto:nexgen.d.pahari@gmail.com";

export function NavContactButton() {
  return (
    <Button
      className="nav-contact-button"
      text="Let’s talk"
      catAnimation
      onClick={() => window.location.assign(CONTACT_EMAIL)}
    />
  );
}
