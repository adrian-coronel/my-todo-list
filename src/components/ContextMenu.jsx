import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Edit2, Trash2 } from 'lucide-react';

const ContextMenu = ({ x, y, entry, onEdit, onClose }) => {
  const { removeEntry } = useApp();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Ajustar para que no salga de pantalla
  const menuStyle = {
    left: Math.min(x, window.innerWidth  - 180),
    top:  Math.min(y, window.innerHeight - 120),
  };

  return (
    <div ref={menuRef} className="context-menu" style={menuStyle}>
      <div className="context-menu-item" onClick={onEdit}>
        <Edit2 size={13}/> Editar entrada
      </div>
      <div className="divider" style={{ margin: '2px 0' }}/>
      <div className="context-menu-item danger" onClick={() => { removeEntry(entry.id); onClose(); }}>
        <Trash2 size={13}/> Eliminar entrada
      </div>
    </div>
  );
};

export default ContextMenu;
