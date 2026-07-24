(function () {
  "use strict";
  const button = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".primary-nav");
  if (!button || !nav) return;

  function closeMenu() {
    nav.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
  }

  button.addEventListener("click", function () {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
      button.focus();
    }
  });
}());

(function () {
  "use strict";

  const modal = document.querySelector("#involvementModal");
  if (!modal) return;

  const dialog = modal.querySelector(".involvement-modal__dialog");
  const closeButton = modal.querySelector(".involvement-modal__close");
  let previousFocus = null;

  function syncScrollLock() {
    const anotherModalOpen = document.querySelector(".faculty-modal.is-open, .involvement-modal.is-open");
    document.body.classList.toggle("modal-open", Boolean(anotherModalOpen));
  }

  function openModal(trigger) {
    previousFocus = trigger;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    syncScrollLock();
    window.requestAnimationFrame(function () { closeButton.focus(); });
  }

  function closeModal() {
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    syncScrollLock();
    if (previousFocus) previousFocus.focus();
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest("[data-open-involvement]");
    if (trigger) {
      event.preventDefault();
      openModal(trigger);
      return;
    }
    if (event.target.closest("[data-close-involvement]")) closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (!modal.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialog.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])"))
      .filter(function (element) { return !element.disabled; });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}());

(function () {
  "use strict";

  const faculties = {
    quran: {
      title: "Madrasah Tarteelul Qur’an",
      icon: "icons/faculty-quran.png",
      accent: "#031d3d",
      button: "Explore Madrasah Programmes",
      paragraphs: [
        "The memorisation of the Noble Qur’an is a sacred journey that requires dedication, structure and spiritual discipline.",
        "At Tarteel Academy, our Hifdh programme is committed to upholding the highest standards of Qur’an memorisation. We ensure that students not only commit the Qur’an to heart, but also maintain accuracy, fluency and excellence in their recitation.",
        "We also extend our expertise to Hifdh institutions and Islamic schools seeking guidance in structuring and managing their own Hifdh programmes."
      ]
    },
    hifdh: {
      title: "Tarteel Hifdh & Makatib",
      icon: "icons/faculty-hifdh.png",
      accent: "#217146",
      button: "Explore Hifdh & Makatib",
      paragraphs: [
        "A Maktab is the foundation of Islamic learning, nurturing young minds through essential Islamic education and moral development.",
        "At a time when external influences can challenge the identity of young Muslims, we provide a safe and nurturing environment where children learn the fundamentals of Islam.",
        "Through structured lessons in Qur’an recitation, Islamic morals and basic Fiqh, we aim to instil a love for the Deen from an early age, helping learners grow into practising and responsible Muslims."
      ]
    },
    skills: {
      title: "School & Skills Development",
      icon: "icons/faculty-skills.png",
      accent: "#552978",
      button: "Explore School & Skills Programmes",
      sections: [
        {
          heading: "Academic Development",
          paragraphs: [
            "At Tarteel Academy, we believe that education should empower students both spiritually and intellectually.",
            "Our academic faculty integrates mainstream schooling with Islamic values, providing a balanced curriculum that nurtures character, knowledge and critical thinking.",
            "We prepare students for higher education and professional careers while ensuring that they remain firmly rooted in their Islamic identity.",
            "Through a structured academic programme alongside Islamic studies, we aim to cultivate individuals who can excel in both Deen and Dunya."
          ]
        },
        {
          heading: "Skills Development",
          paragraphs: [
            "Tarteel Skills Development aims to equip learners with the knowledge, confidence and practical abilities needed to succeed in their personal and professional lives.",
            "Our programmes combine valuable skills training with Islamic values, helping learners develop discipline, independence and a strong sense of purpose.",
            "Through structured development opportunities, we aim to prepare individuals for further education, employment, entrepreneurship and meaningful participation within their communities."
          ]
        }
      ]
    },
    social: {
      title: "Tarteel Social Development",
      icon: "icons/faculty-social.png",
      accent: "#d96518",
      button: "Explore Social Programmes",
      paragraphs: [
        "Islam encourages service to humanity, and our Community Outreach Programme is built upon this important principle.",
        "We strive to uplift society through structured initiatives, partnerships and service programmes.",
        "Through da’wah, wellness drives, parent engagement and youth mentorship, we aim to follow the example of our beloved Nabi ﷺ in charity, compassion and leadership.",
        "Our goal is for the light of the Qur’an to reach every household and every soul within our community."
      ]
    },
    female: {
      title: "Tarteel Female Empowerment",
      icon: "icons/faculty-female.png",
      accent: "#ad2054",
      button: "Explore Female Programmes",
      paragraphs: [
        "The Female Education Faculty at Tarteel Academy is dedicated to empowering women through education and fostering a strong foundation in both Islamic knowledge and essential life skills.",
        "We recognise the important role women play in shaping communities and future generations.",
        "By offering Qur’an memorisation, Islamic studies and personal development programmes, we aim to develop confident and knowledgeable women who embody Islamic values while actively contributing to society."
      ]
    }
  };

  const modal = document.querySelector(".faculty-modal");
  if (!modal) return;

  const assetBase = modal.dataset.assetBase || "assets";
  const dialog = modal.querySelector(".faculty-modal__dialog");
  const title = modal.querySelector("#faculty-modal-title");
  const icon = modal.querySelector(".faculty-modal__icon");
  const content = modal.querySelector(".faculty-modal__content");
  const action = modal.querySelector(".faculty-modal__action");
  const closeButton = modal.querySelector(".faculty-modal__close");
  let previousFocus = null;

  function paragraphMarkup(paragraphs) {
    return paragraphs.map(function (paragraph) {
      const node = document.createElement("p");
      node.textContent = paragraph;
      return node.outerHTML;
    }).join("");
  }

  function renderContent(faculty) {
    if (faculty.sections) {
      return faculty.sections.map(function (section) {
        const heading = document.createElement("h3");
        heading.textContent = section.heading;
        return heading.outerHTML + paragraphMarkup(section.paragraphs);
      }).join("");
    }
    return paragraphMarkup(faculty.paragraphs);
  }

  function openModal(key, trigger) {
    const faculty = faculties[key];
    if (!faculty) return;
    previousFocus = trigger;
    title.textContent = faculty.title;
    icon.src = assetBase + "/" + faculty.icon;
    icon.alt = "";
    content.innerHTML = renderContent(faculty);
    action.textContent = faculty.button;
    modal.style.setProperty("--modal-accent", faculty.accent);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    window.requestAnimationFrame(function () { closeButton.focus(); });
  }

  function closeModal() {
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (previousFocus) previousFocus.focus();
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest(".faculty-modal-trigger");
    if (trigger) {
      event.preventDefault();
      openModal(trigger.dataset.faculty, trigger);
      return;
    }
    if (event.target.closest("[data-modal-close]")) closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (!modal.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialog.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])"))
      .filter(function (element) { return !element.disabled; });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}());
