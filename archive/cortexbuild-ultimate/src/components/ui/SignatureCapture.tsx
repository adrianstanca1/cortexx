/**
 * SignatureCapture — HTML5 Canvas-based electronic signature pad.
 * eIDAS compliant for UK construction documents.
 * Outputs a base64 PNG data URL.
 */
import React, { useRef, useState, useCallback } from 'react';
import { Eraser, Check } from 'lucide-react';

interface SignatureCaptureProps {
  onSign: (signatureData: string) => void;
  onCancel: () => void;
  signerName?: string;
  disabled?: boolean;
}

export function SignatureCapture({ onSign, onCancel, signerName, disabled }: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Set up drawing style
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = getContext();
    if (!ctx || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  }, [disabled, getContext]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const ctx = getContext();
    if (!ctx || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }, [isDrawing, disabled, getContext]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, [getContext]);

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    onSign(dataUrl);
  }, [hasSignature, onSign]);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Electronic Signature</h3>
          {signerName && <p className="text-xs text-gray-400">Signing as: {signerName}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearSignature}
            disabled={disabled || !hasSignature}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
            title="Clear"
          >
            <Eraser size={16} />
          </button>
        </div>
      </div>

      {/* Signature line label */}
      <div className="relative">
        <p className="absolute top-2 left-3 text-xs text-gray-500">Sign above</p>
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="w-full border border-gray-600 rounded-lg bg-white cursor-crosshair touch-none"
          style={{ height: 150 }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <div className="absolute bottom-0 left-0 right-0 border-b border-gray-400 pointer-events-none" style={{ marginBottom: 20 }} />
        <p className="absolute bottom-1 left-3 text-xs text-gray-400">X</p>
      </div>

      <p className="text-xs text-gray-500">
        By signing above, you confirm this document is authentic and legally binding under eIDAS regulations.
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={saveSignature}
          disabled={disabled || !hasSignature}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          <Check size={14} /> Confirm Signature
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 rounded-lg bg-gray-800 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * SignatureDisplay — shows a saved signature with metadata.
 */
interface SignatureDisplayProps {
  signature: {
    signer_name: string;
    signer_role?: string;
    signed_at: string;
    signature_data?: string;
  };
  compact?: boolean;
}

export function SignatureDisplay({ signature, compact }: SignatureDisplayProps) {
  const date = new Date(signature.signed_at).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Check size={12} className="text-green-400" />
        <span>{signature.signer_name}</span>
        {signature.signer_role && <span>— {signature.signer_role}</span>}
        <span>{date}</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">{signature.signer_name}</p>
          {signature.signer_role && <p className="text-xs text-gray-400">{signature.signer_role}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{date}</p>
          <p className="text-xs text-green-400 flex items-center gap-1 justify-end"><Check size={10} /> Signed</p>
        </div>
      </div>
      {signature.signature_data && (
        <img
          src={signature.signature_data}
          alt={`Signature of ${signature.signer_name}`}
          className="h-12 bg-white rounded border border-gray-600"
        />
      )}
    </div>
  );
}
