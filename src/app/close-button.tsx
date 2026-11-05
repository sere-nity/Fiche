"use client";

export function CloseButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            aria-label="Close"
            onClick={onClick}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-rule-soft hover:text-foreground"
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
            >
                <path d="M6 6l12 12M18 6L6 18" />
            </svg>
        </button>
    );
}
