import React, { useState, useMemo } from 'react';
import { useActivity } from '../context/ActivityContext';
import { PlusCircle } from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import { format } from 'date-fns';

const LogForm = () => {
  const { addActivity, activities } = useActivity();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const [formData, setFormData] = useState({
    client: '',
    project: '',
    taskName: '',
    description: '',
    date: today,
    startTime: '09:00',
    endTime: '10:00'
  });

  const clientOptions = useMemo(() => {
    const clients = new Set(activities.map(a => a.client).filter(Boolean));
    return Array.from(clients).map(c => ({ value: c, label: c }));
  }, [activities]);

  const projectOptions = useMemo(() => {
    const projects = new Set(activities.filter(a => a.client === formData.client).map(a => a.project).filter(Boolean));
    return Array.from(projects).map(p => ({ value: p, label: p }));
  }, [activities, formData.client]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name, newValue) => {
    setFormData(prev => ({ ...prev, [name]: newValue ? newValue.value : '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.client || !formData.project || !formData.taskName) return;
    
    addActivity(formData);
    // Reiniciar un poco sin perder cliente/proyecto
    setFormData(prev => ({
      ...prev,
      taskName: '',
      description: '',
      startTime: prev.endTime, 
      endTime: String(parseInt(prev.endTime.split(':')[0]) + 1).padStart(2, '0') + ':00'
    }));
  };

  // Custom styles for react-select matching glassmorphism
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      background: 'rgba(0, 0, 0, 0.2)',
      borderColor: state.isFocused ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
      color: 'var(--text-main)',
      minHeight: '42px',
      borderRadius: 'var(--radius-sm)',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.15)'
      }
    }),
    menu: (base) => ({
      ...base,
      background: '#1a1c23',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
      color: 'var(--text-main)',
      '&:active': {
        backgroundColor: 'rgba(59, 130, 246, 0.4)'
      }
    }),
    singleValue: (base) => ({ ...base, color: 'var(--text-main)' }),
    input: (base) => ({ ...base, color: 'var(--text-main)' }),
    placeholder: (base) => ({ ...base, color: 'var(--text-muted)' })
  };

  return (
    <div className="glass-panel" style={{ overflow: 'visible' }}>
      <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <PlusCircle size={20} color="var(--accent-success)" />
        Nuevo Registro
      </h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        <div className="form-group" style={{ margin: 0 }}>
          <label>Cliente</label>
          <CreatableSelect
            styles={selectStyles}
            options={clientOptions}
            value={formData.client ? { value: formData.client, label: formData.client } : null}
            onChange={(val) => handleSelectChange('client', val)}
            placeholder="Seleccionar o escribir..."
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>Proyecto</label>
          <CreatableSelect
            styles={selectStyles}
            options={projectOptions}
            value={formData.project ? { value: formData.project, label: formData.project } : null}
            onChange={(val) => handleSelectChange('project', val)}
            placeholder="Seleccionar o escribir..."
          />
        </div>
        
        <div className="form-group" style={{ margin: 0 }}>
          <label>Tarea Creada</label>
          <input required type="text" name="taskName" className="form-control" value={formData.taskName} onChange={handleChange} placeholder="Ej. Investigar APIs" />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '130px', margin: 0 }}>
            <label>Fecha</label>
            <input required type="date" name="date" className="form-control" value={formData.date} onChange={handleChange} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '100px', margin: 0 }}>
            <label>Inicio</label>
            <input required type="time" name="startTime" className="form-control" value={formData.startTime} onChange={handleChange} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '100px', margin: 0 }}>
            <label>Fin</label>
            <input required type="time" name="endTime" className="form-control" value={formData.endTime} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>Descripción</label>
          <textarea name="description" className="form-control" value={formData.description} onChange={handleChange} rows="2" placeholder="Detalles de este bloque de tiempo..."></textarea>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
          Registrar Actividad
        </button>
      </form>
    </div>
  );
};

export default LogForm;
