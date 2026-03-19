import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isSameDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

const ActivityContext = createContext();

export const useActivity = () => useContext(ActivityContext);

export const ActivityProvider = ({ children }) => {
  // Inicializar actividades desde localStorage o arreglo vacío
  const [activities, setActivities] = useState(() => {
    const saved = localStorage.getItem('tracker_activities');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Guardar en localStorage cuando haya cambios
  useEffect(() => {
    localStorage.setItem('tracker_activities', JSON.stringify(activities));
  }, [activities]);

  // Agregar una nueva actividad
  const addActivity = (activity) => {
    const newActivity = {
      ...activity,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    setActivities(prev => [...prev, newActivity]);
  };

  // Actualizar una actividad existente (útil para resize o mover)
  const updateActivity = (id, updates) => {
    setActivities(prev => prev.map(act => act.id === id ? { ...act, ...updates } : act));
  };

  // Eliminar actividad
  const removeActivity = (id) => {
    setActivities(prev => prev.filter(act => act.id !== id));
  };

  // Obtener actividades del día específico
  const getActivitiesByDay = (dateString) => {
    return activities.filter(act => act.date === dateString);
  };

  // Obtener resumen del día (agrupado por proyecto/tarea)
  const getDailySummary = (dateString) => {
    const dailyActs = getActivitiesByDay(dateString);
    const summary = {};
    
    dailyActs.forEach(act => {
      const key = `${act.client}-${act.project}-${act.taskName}`;
      if (!summary[key]) {
        summary[key] = {
          client: act.client,
          project: act.project,
          taskName: act.taskName,
          totalMinutes: 0,
          entries: []
        };
      }
      
      const [sh, sm] = act.startTime.split(':').map(Number);
      const [eh, em] = act.endTime.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      
      // Si el tiempo es negativo (ej. cruzó medianoche)
      if (diff < 0) diff += 24 * 60;
      
      summary[key].totalMinutes += diff;
      summary[key].entries.push(act);
    });
    
    return Object.values(summary);
  };

  return (
    <ActivityContext.Provider value={{
      activities,
      addActivity,
      updateActivity,
      removeActivity,
      getActivitiesByDay,
      getDailySummary
    }}>
      {children}
    </ActivityContext.Provider>
  );
};
