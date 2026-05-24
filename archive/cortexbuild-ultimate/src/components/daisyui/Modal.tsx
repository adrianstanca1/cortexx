import React, { useRef, useCallback } from 'react';

interface ModalProps {
  id: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  closeButton?: boolean;
  backdropClose?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  id,
  title,
  subtitle,
  children,
  actions,
  closeButton = true,
  backdropClose = false,
  className = '',
}) => {
  const modalRef = useRef<HTMLDialogElement>(null);

  const _open = useCallback(() => {
    modalRef.current?.showModal();
  }, []);

  const _close = useCallback(() => {
    modalRef.current?.close();
  }, []);

  return (
    <>
      <dialog id={id} ref={modalRef} className={`modal ${className}`}>
        <div className="modal-box">
          {title && (
            <h3 className="font-bold text-lg mb-2">
              {title}
              {subtitle && <p className="font-normal text-sm text-base-content/70 mt-1">{subtitle}</p>}
            </h3>
          )}
          {children}
          {(actions || closeButton) && (
            <div className="modal-action">
              {actions}
              {closeButton && (
                <form method="dialog">
                  <button className="btn">Close</button>
                </form>
              )}
            </div>
          )}
        </div>
        {backdropClose && (
          <form method="dialog" className="modal-backdrop">
            <button>close</button>
          </form>
        )}
      </dialog>

    </>
  );
};
