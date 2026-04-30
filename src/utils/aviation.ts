
export const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const minutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const addMinutes = (time: string, minutesToAdd: number): string => {
  const mins = timeToMinutes(time);
  return minutesToTime(mins + minutesToAdd);
};

export const diffMinutes = (startTime: string, endTime: string): number => {
  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end < start) end += 24 * 60; // Crosses midnight
  return end - start;
};

export const getPilotTSMax = (
  horaPresentacion: string,
  segmentos: string,
  tipoTripulacion: string,
  claseDescanso: string
): number => {
  if (tipoTripulacion === 'Mínima') {
    const mins = timeToMinutes(horaPresentacion);
    let segNum = 1;
    if (segmentos.includes('3-4')) segNum = 3;
    else if (segmentos.includes('5')) segNum = 5;
    else if (segmentos.includes('6')) segNum = 6;
    else if (segmentos.includes('7+')) segNum = 7;
    else if (segmentos.includes('1-2')) segNum = 1;
    else segNum = parseInt(segmentos) || 1;
    
    // Table based on provided image
    // 00:00 - 03:59
    if (mins >= 0 && mins <= 239) {
      return 9 * 60;
    }
    // 04:00 - 04:59
    if (mins >= 240 && mins <= 299) {
      if (segNum <= 4) return 10 * 60;
      return 9 * 60;
    }
    // 05:00 - 05:59
    if (mins >= 300 && mins <= 359) {
      if (segNum <= 4) return 12 * 60;
      if (segNum === 5) return 11.5 * 60;
      if (segNum === 6) return 11 * 60;
      return 10.5 * 60;
    }
    // 06:00 - 06:59
    if (mins >= 360 && mins <= 419) {
      if (segNum <= 2) return 13 * 60;
      if (segNum <= 4) return 12 * 60;
      if (segNum === 5) return 11.5 * 60;
      if (segNum === 6) return 11 * 60;
      return 10.5 * 60;
    }
    // 07:00 - 11:59
    if (mins >= 420 && mins <= 719) {
      if (segNum <= 2) return 14 * 60;
      if (segNum <= 4) return 13 * 60;
      if (segNum === 5) return 12.5 * 60;
      if (segNum === 6) return 12 * 60;
      return 11.5 * 60;
    }
    // 12:00 - 12:59
    if (mins >= 720 && mins <= 779) {
      if (segNum <= 4) return 13 * 60;
      if (segNum === 5) return 12.5 * 60;
      if (segNum === 6) return 12 * 60;
      return 11.5 * 60;
    }
    // 13:00 - 16:59
    if (mins >= 780 && mins <= 1019) {
      if (segNum <= 4) return 12 * 60;
      if (segNum === 5) return 11.5 * 60;
      if (segNum === 6) return 11 * 60;
      return 10.5 * 60;
    }
    // 17:00 - 21:59
    if (mins >= 1020 && mins <= 1319) {
      if (segNum <= 2) return 12 * 60;
      if (segNum <= 4) return 11 * 60;
      if (segNum === 5) return 10 * 60;
      return 9 * 60;
    }
    // 22:00 - 22:59
    if (mins >= 1320 && mins <= 1379) {
      if (segNum <= 2) return 11 * 60;
      if (segNum <= 4) return 10 * 60;
      return 9 * 60;
    }
    // 23:00 - 23:59
    if (mins >= 1380 && mins <= 1439) {
      if (segNum <= 2) return 10 * 60;
      return 9 * 60;
    }
    return 9 * 60;
  } else {
    // Aumentada
    const mins = timeToMinutes(horaPresentacion);
    const is3Pil = tipoTripulacion.includes('3 Pil');
    
    // 00:00 - 05:59
    if (mins >= 0 && mins <= 359) {
      if (claseDescanso === 'Clase 1') return (is3Pil ? 15 : 17) * 60;
      if (claseDescanso === 'Clase 2') return (is3Pil ? 14 : 15.5) * 60;
      return (is3Pil ? 13 : 13.5) * 60;
    }
    // 06:00 - 06:59
    if (mins >= 360 && mins <= 419) {
      if (claseDescanso === 'Clase 1') return (is3Pil ? 16 : 18.5) * 60;
      if (claseDescanso === 'Clase 2') return (is3Pil ? 15 : 16.5) * 60;
      return (is3Pil ? 14 : 14.5) * 60;
    }
    // 07:00 - 12:59
    if (mins >= 420 && mins <= 779) {
      if (claseDescanso === 'Clase 1') return (is3Pil ? 17 : 19) * 60;
      if (claseDescanso === 'Clase 2') return (is3Pil ? 16.5 : 18) * 60;
      return (is3Pil ? 15 : 15.5) * 60;
    }
    // 13:00 - 16:59
    if (mins >= 780 && mins <= 1019) {
      if (claseDescanso === 'Clase 1') return (is3Pil ? 16 : 18.5) * 60;
      if (claseDescanso === 'Clase 2') return (is3Pil ? 15 : 16.5) * 60;
      return (is3Pil ? 14 : 14.5) * 60;
    }
    // 17:00 - 23:59
    if (mins >= 1020 && mins <= 1439) {
      if (claseDescanso === 'Clase 1') return (is3Pil ? 15 : 17) * 60;
      if (claseDescanso === 'Clase 2') return (is3Pil ? 14 : 15.5) * 60;
      return (is3Pil ? 13 : 13.5) * 60;
    }
    return 13 * 60;
  }
};

export const getTcpTSMax = (config: string): number => {
  if (config === 'minima') return 14 * 60;
  if (config === 'minima1') return 16 * 60;
  return 18 * 60;
};
