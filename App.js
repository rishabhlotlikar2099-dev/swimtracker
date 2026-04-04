import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

let HapticsModule = null;
try {
  HapticsModule = require('expo-haptics');
} catch (error) {
  HapticsModule = null;
}

const STROKE_OPTIONS = ['Freestyle', 'Butterfly', 'Backstroke', 'Breaststroke', 'IM'];
const DISTANCE_OPTIONS = [25, 50, 100, 200, 400, 800, 1500, 5000, 10000];
const BASE_EVENTS_META = [
  { label: '50 Freestyle', stroke: 'Freestyle', distance: 50 },
  { label: '100 Freestyle', stroke: 'Freestyle', distance: 100 },
  { label: '200 Freestyle', stroke: 'Freestyle', distance: 200 },
  { label: '400 Freestyle', stroke: 'Freestyle', distance: 400 },
  { label: '800 Freestyle', stroke: 'Freestyle', distance: 800 },
  { label: '1500 Freestyle', stroke: 'Freestyle', distance: 1500 },
  { label: '50 Butterfly', stroke: 'Butterfly', distance: 50 },
  { label: '100 Butterfly', stroke: 'Butterfly', distance: 100 },
  { label: '200 Butterfly', stroke: 'Butterfly', distance: 200 },
  { label: '50 Backstroke', stroke: 'Backstroke', distance: 50 },
  { label: '100 Backstroke', stroke: 'Backstroke', distance: 100 },
  { label: '200 Backstroke', stroke: 'Backstroke', distance: 200 },
  { label: '50 Breaststroke', stroke: 'Breaststroke', distance: 50 },
  { label: '100 Breaststroke', stroke: 'Breaststroke', distance: 100 },
  { label: '200 Breaststroke', stroke: 'Breaststroke', distance: 200 },
  { label: '200 IM', stroke: 'IM', distance: 200 },
  { label: '400 IM', stroke: 'IM', distance: 400 },
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDialTime({ hours = 0, minutes, seconds, centiseconds }, includeHours = false) {
  const baseTime = `${pad2(minutes)}:${pad2(seconds)}.${pad2(centiseconds)}`;
  if (!includeHours) return baseTime;
  return `${pad2(hours)}:${baseTime}`;
}

function parseDialValuesToSeconds({ hours = 0, minutes, seconds, centiseconds }, includeHours = false) {
  if (minutes > 59 || seconds > 59 || centiseconds > 99) return null;
  if (includeHours && (hours < 0 || hours > 23)) return null;
  return (includeHours ? hours * 3600 : 0) + minutes * 60 + seconds + centiseconds / 100;
}

function parseDateToTimestamp(dateString) {
  const value = dateString.trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const utcMillis = Date.UTC(year, month - 1, day);
  const checkDate = new Date(utcMillis);

  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day
  ) {
    return null;
  }

  return utcMillis;
}

function formatSeconds(totalSeconds) {
  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds - hours * 3600) / 60);
    const seconds = totalSeconds - hours * 3600 - minutes * 60;
    return `${hours}:${pad2(minutes)}:${seconds.toFixed(2).padStart(5, '0')}`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  if (minutes <= 0) return `${seconds.toFixed(2)}s`;
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
}

function sortEntriesByDateAndTime(entries) {
  return [...entries].sort((a, b) => {
    if (b.dateTimestamp !== a.dateTimestamp) {
      return b.dateTimestamp - a.dateTimestamp;
    }

    if (a.timeSeconds !== b.timeSeconds) {
      return a.timeSeconds - b.timeSeconds;
    }

    return b.createdAt - a.createdAt;
  });
}

function formatCalendarHeader(date) {
  return date.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayWeekIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let i = 0; i < firstDayWeekIndex; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= totalDaysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function formatDistanceLabel(distance) {
  if (distance === 5000 || distance === 10000) {
    return `${distance / 1000}KM`;
  }
  return `${distance}`;
}

function buildEventLabel(stroke, distance) {
  const formattedDistance = formatDistanceLabel(distance);
  if (stroke === 'IM') {
    return `${formattedDistance} IM`;
  }
  return `${formattedDistance} ${stroke}`;
}

function eventNeedsHourDial(eventLabel) {
  if (!eventLabel) return false;
  return /\b(5km|10km)\b/i.test(eventLabel);
}

function triggerHapticFeedback() {
  if (HapticsModule?.selectionAsync) {
    HapticsModule.selectionAsync();
  }
}

function HapticPressable({ style, onPress, children, disabled = false }) {
  return (
    <Pressable
      onPress={(event) => {
        if (disabled) return;
        triggerHapticFeedback();
        onPress?.(event);
      }}
      style={({ pressed }) => [style, disabled && styles.disabledPressable, pressed && !disabled && styles.subtlePressFeedback]}
    >
      {children}
    </Pressable>
  );
}

function SpinDial({ label, value, maxValue, onChange, resetSignal, accentColor, dialBackgroundColor, compact = false }) {
  const ITEM_HEIGHT = compact ? 46 : 50;
  const HIGHLIGHT_HEIGHT = compact ? 40 : 44;
  const DIAL_WIDTH = compact ? 63 : 72;
  const CENTER_OFFSET = ITEM_HEIGHT / 2;
  const VISIBLE_ROWS = 5;
  const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
  const TOTAL = maxValue + 1;
  const PERIOD = TOTAL * ITEM_HEIGHT;
  const items = React.useMemo(() => Array.from({ length: TOTAL }, (_, i) => i), [TOTAL]);

  const positionRef = React.useRef(-(value * ITEM_HEIGHT + CENTER_OFFSET));
  const velocityRef = React.useRef(0);
  const isDraggingRef = React.useRef(false);
  const lastYRef = React.useRef(0);
  const animationFrameRef = React.useRef(null);
  const [, setRenderTick] = React.useState(0);

  const normalizePosition = React.useCallback((input) => {
    const halfPeriod = PERIOD / 2;
    let p = input;
    while (p > halfPeriod) p -= PERIOD;
    while (p < -halfPeriod) p += PERIOD;
    return p;
  }, [PERIOD]);

  const forceRender = () => setRenderTick((n) => n + 1);

  const updatePosition = React.useCallback((nextPosition) => {
    positionRef.current = normalizePosition(nextPosition);
    forceRender();
  }, [normalizePosition]);

  const settleAndEmit = React.useCallback(() => {
    const snapped = Math.round((positionRef.current + CENTER_OFFSET) / ITEM_HEIGHT) * ITEM_HEIGHT - CENTER_OFFSET;
    positionRef.current = normalizePosition(snapped);
    forceRender();

    const selected = ((-Math.round((positionRef.current + CENTER_OFFSET) / ITEM_HEIGHT)) % TOTAL + TOTAL) % TOTAL;
    if (selected !== value) {
      onChange(selected);
    }
  }, [CENTER_OFFSET, ITEM_HEIGHT, TOTAL, normalizePosition, onChange, value]);

  const snapToStep = React.useCallback(() => {
    const snappedTarget =
      Math.round((positionRef.current + CENTER_OFFSET) / ITEM_HEIGHT) * ITEM_HEIGHT - CENTER_OFFSET;

    const animateSnap = () => {
      const diff = snappedTarget - positionRef.current;
      positionRef.current += diff * 0.096;
      positionRef.current = normalizePosition(positionRef.current);
      forceRender();

      if (Math.abs(diff) < 0.2) {
        settleAndEmit();
        return;
      }
      animationFrameRef.current = requestAnimationFrame(animateSnap);
    };

    animateSnap();
  }, [CENTER_OFFSET, ITEM_HEIGHT, normalizePosition, settleAndEmit]);

  const applyInertia = React.useCallback(() => {
    const animate = () => {
      positionRef.current += velocityRef.current;
      positionRef.current = normalizePosition(positionRef.current);
      velocityRef.current *= 0.95;
      forceRender();

      if (Math.abs(velocityRef.current) < 0.08) {
        snapToStep();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [normalizePosition, snapToStep]);

  React.useEffect(() => {
    positionRef.current = -(value * ITEM_HEIGHT + CENTER_OFFSET);
    forceRender();
  }, [CENTER_OFFSET, ITEM_HEIGHT, resetSignal, value]);

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          triggerHapticFeedback();
          isDraggingRef.current = true;
          velocityRef.current = 0;
          lastYRef.current = evt.nativeEvent.pageY;
        },
        onPanResponderMove: (evt) => {
          if (!isDraggingRef.current) return;
          const y = evt.nativeEvent.pageY;
          const delta = y - lastYRef.current;
          lastYRef.current = y;
          velocityRef.current = delta;
          updatePosition(positionRef.current + delta);
        },
        onPanResponderRelease: () => {
          if (!isDraggingRef.current) return;
          isDraggingRef.current = false;
          applyInertia();
        },
        onPanResponderTerminate: () => {
          if (!isDraggingRef.current) return;
          isDraggingRef.current = false;
          applyInertia();
        },
      }),
    [applyInertia, updatePosition]
  );

  return (
    <View style={[styles.dialWrap, compact && styles.dialWrapCompact, { width: DIAL_WIDTH }]}>
      <Text style={[styles.dialLabel, compact && styles.dialLabelCompact, { color: accentColor }]}>{label}</Text>
      <View
        style={[
          styles.dialValueViewport,
          compact && styles.dialValueViewportCompact,
          { width: DIAL_WIDTH, height: WHEEL_HEIGHT, borderColor: accentColor, backgroundColor: dialBackgroundColor },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.dialItemsLayer}>
          {items.map((item) => {
            const itemBase = item * ITEM_HEIGHT + positionRef.current;
            const wrapped = ((itemBase + PERIOD / 2) % PERIOD + PERIOD) % PERIOD - PERIOD / 2;
            const distance = Math.abs(wrapped);
            if (distance > ITEM_HEIGHT * 3) return null;
            const scale = Math.max(1 - distance / 300, 0.6);
            const opacity = Math.max(1 - distance / 200, 0.2);

            return (
              <View
                key={`${label}-${item}`}
                style={[
                  styles.dialValueBox,
                  compact && styles.dialValueBoxCompact,
                  {
                    width: DIAL_WIDTH,
                    height: ITEM_HEIGHT,
                    transform: [{ translateY: wrapped }, { scale }],
                    opacity,
                  },
                ]}
              >
                <Text style={[styles.dialWheelText, compact && styles.dialWheelTextCompact, { color: accentColor }]}>
                  {pad2(item)}
                </Text>
              </View>
            );
          })}
        </View>
        <View
          style={[
            styles.dialCenterHighlight,
            {
              top: ITEM_HEIGHT * 2 + (ITEM_HEIGHT - HIGHLIGHT_HEIGHT) / 2,
              height: HIGHLIGHT_HEIGHT,
              borderColor: accentColor,
              backgroundColor: `${accentColor}22`,
              pointerEvents: 'none',
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [userName, setUserName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [isNamePromptVisible, setIsNamePromptVisible] = useState(false);
  const [hasPromptedForName, setHasPromptedForName] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [timeDialValues, setTimeDialValues] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    centiseconds: 0,
  });
  const [dateInput, setDateInput] = useState('');
  const [timesByEvent, setTimesByEvent] = useState({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [dialResetSignal, setDialResetSignal] = useState(0);
  const [customEvents, setCustomEvents] = useState([]);
  const [isCustomEventModalVisible, setIsCustomEventModalVisible] = useState(false);
  const [selectedStrokeOption, setSelectedStrokeOption] = useState('');
  const [selectedDistanceOption, setSelectedDistanceOption] = useState(null);
  const [isStrokeDropdownOpen, setIsStrokeDropdownOpen] = useState(false);
  const [isDistanceDropdownOpen, setIsDistanceDropdownOpen] = useState(false);

  const currentEntries = useMemo(() => {
    if (!selectedEvent) return [];
    return timesByEvent[selectedEvent] || [];
  }, [selectedEvent, timesByEvent]);

  const sortedEntries = useMemo(() => sortEntriesByDateAndTime(currentEntries), [currentEntries]);

  const latestEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;

  const fastestEntry = useMemo(() => {
    if (currentEntries.length === 0) return null;
    return currentEntries.reduce((fastest, entry) =>
      entry.timeSeconds < fastest.timeSeconds ? entry : fastest
    );
  }, [currentEntries]);

  const calendarDays = useMemo(() => createCalendarDays(calendarViewDate), [calendarViewDate]);
  const selectedDateTimestamp = parseDateToTimestamp(dateInput);
  const shouldShowHourDial = useMemo(() => eventNeedsHourDial(selectedEvent), [selectedEvent]);
  const dialTimePreview = useMemo(
    () => formatDialTime(timeDialValues, shouldShowHourDial),
    [shouldShowHourDial, timeDialValues]
  );
  const bestTimeByEvent = useMemo(() => {
    const bestMap = {};
    Object.keys(timesByEvent).forEach((eventName) => {
      const entries = timesByEvent[eventName] || [];
      if (entries.length === 0) return;
      const bestEntry = entries.reduce((best, entry) =>
        entry.timeSeconds < best.timeSeconds ? entry : best
      );
      bestMap[eventName] = bestEntry;
    });
    return bestMap;
  }, [timesByEvent]);
  const allEvents = useMemo(() => {
    const merged = [...BASE_EVENTS_META, ...customEvents];
    return merged
      .sort((a, b) => {
        const strokeCompare = STROKE_OPTIONS.indexOf(a.stroke) - STROKE_OPTIONS.indexOf(b.stroke);
        if (strokeCompare !== 0) return strokeCompare;
        return a.distance - b.distance;
      })
      .map((entry) => entry.label);
  }, [customEvents]);
  const customEventLabelSet = useMemo(
    () => new Set(customEvents.map((eventItem) => eventItem.label)),
    [customEvents]
  );
  const isSelectedEventCustom = selectedEvent ? customEventLabelSet.has(selectedEvent) : false;
  const theme = useMemo(
    () =>
      isDarkMode
        ? {
            background: '#020817',
            surface: '#0f1b33',
            border: '#66a3ff',
            textPrimary: '#e7edf8',
            textSecondary: '#9fb2d9',
          }
        : {
            background: '#f6fbff',
            surface: '#ffffff',
            border: '#1a3d7a',
            textPrimary: '#0f274d',
            textSecondary: '#33527f',
          },
    [isDarkMode]
  );
  const themedCardStyle = useMemo(
    () => ({
      backgroundColor: theme.surface,
      borderColor: theme.border,
      ...(isDarkMode
        ? { boxShadow: `0px 0px 6px ${theme.border}` }
        : {}),
    }),
    [isDarkMode, theme]
  );
  const todayDateTimestamp = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }, []);

  React.useEffect(() => {
    if (!hasPromptedForName && activePage === 'home' && !userName.trim()) {
      setIsNamePromptVisible(true);
      setHasPromptedForName(true);
    }
  }, [activePage, hasPromptedForName, userName]);

  const updateDialValue = (key, nextValue) => {
    setTimeDialValues((prev) => {
      return {
        ...prev,
        [key]: nextValue,
      };
    });
  };

  const resetTimeEntryInputs = () => {
    setTimeDialValues({
      hours: 0,
      minutes: 0,
      seconds: 0,
      centiseconds: 0,
    });
    setDialResetSignal((prev) => prev + 1);
    setDateInput('');
  };

  const handleBackToEventList = () => {
    resetTimeEntryInputs();
    setSelectedEvent(null);
  };

  const handleAddTime = () => {
    const cleanTime = dialTimePreview;
    const cleanDate = dateInput.trim();

    if (!cleanDate) {
      Alert.alert('Missing date', 'Please choose a date before saving the time.');
      return;
    }

    const dateTimestamp = parseDateToTimestamp(cleanDate);
    if (dateTimestamp === null) {
      Alert.alert('Invalid date', 'Please use a valid date in YYYY-MM-DD format.');
      return;
    }

    const parsedSeconds = parseDialValuesToSeconds(timeDialValues, shouldShowHourDial);
    if (parsedSeconds === null) {
      Alert.alert(
        'Invalid time',
        shouldShowHourDial
          ? 'Hours must be 00–23, minutes/seconds must be 00–59, and milliseconds must be 00–99.'
          : 'Minutes/seconds must be 00–59 and milliseconds must be 00–99.'
      );
      return;
    }

    const newEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timeInput: cleanTime,
      date: cleanDate,
      dateTimestamp,
      timeSeconds: parsedSeconds,
      createdAt: Date.now(),
    };

    setTimesByEvent((prev) => {
      const existing = prev[selectedEvent] || [];
      return {
        ...prev,
        [selectedEvent]: [...existing, newEntry],
      };
    });

    resetTimeEntryInputs();
  };

  const confirmDeleteEntry = (entry) => {
    Alert.alert('Delete time entry?', `Delete ${entry.timeInput} on ${entry.date}?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setTimesByEvent((prev) => {
            const existing = prev[selectedEvent] || [];
            return {
              ...prev,
              [selectedEvent]: existing.filter((record) => record.id !== entry.id),
            };
          });
        },
      },
    ]);
  };

  const confirmDeleteCustomEvent = () => {
    if (!selectedEvent || !isSelectedEventCustom) return;
    Alert.alert('Delete custom event?', `Delete custom event "${selectedEvent}" and all its times?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setCustomEvents((prev) => prev.filter((eventItem) => eventItem.label !== selectedEvent));
          setTimesByEvent((prev) => {
            const { [selectedEvent]: _removed, ...rest } = prev;
            return rest;
          });
          handleBackToEventList();
        },
      },
    ]);
  };

  if (activePage === 'settings') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.container}>
          <View style={styles.settingsHeaderRow}>
            <HapticPressable style={[styles.backButton, themedCardStyle]} onPress={() => setActivePage('home')}>
              <Text style={[styles.backButtonText, { color: theme.textPrimary }]}>←</Text>
            </HapticPressable>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>
          </View>

          <View style={[styles.settingsCard, themedCardStyle]}>
            <Text style={[styles.settingsItemTitle, { color: theme.textPrimary }]}>Name</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Enter your name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.nameInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
            />
            <HapticPressable
              style={[styles.themeToggleButton, { borderColor: theme.border, marginTop: 10 }]}
              onPress={() => {
                setUserName(nameDraft.trim());
              }}
            >
              <Text style={[styles.themeToggleText, { color: theme.textPrimary }]}>Update Name</Text>
            </HapticPressable>
          </View>

          <View style={[styles.settingsCard, themedCardStyle]}>
            <Text style={[styles.settingsItemTitle, { color: theme.textPrimary }]}>App Theme</Text>
            <HapticPressable style={[styles.themeToggleButton, { borderColor: theme.border }]} onPress={() => setIsDarkMode((prev) => !prev)}>
              <Text style={[styles.themeToggleText, { color: theme.textPrimary }]}>
                {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </Text>
            </HapticPressable>
          </View>

          <View style={[styles.settingsCard, themedCardStyle]}>
            <Text style={[styles.settingsItemTitle, { color: theme.textPrimary }]}>Custom Event</Text>
            <HapticPressable
              style={[styles.themeToggleButton, { borderColor: theme.border, marginTop: 6 }]}
              onPress={() => setIsCustomEventModalVisible(true)}
            >
              <Text style={[styles.themeToggleText, { color: theme.textPrimary }]}>Add Custom Event</Text>
            </HapticPressable>
          </View>

          <View style={[styles.settingsCard, themedCardStyle]}>
            <Text style={[styles.settingsItemTitle, { color: theme.textPrimary }]}>Data Storage</Text>
            <Text style={[styles.settingsItemValue, { color: theme.textSecondary }]}>Local memory only</Text>
          </View>

          <View style={[styles.settingsCard, themedCardStyle]}>
            <Text style={[styles.settingsItemTitle, { color: theme.textPrimary }]}>Version</Text>
            <Text style={[styles.settingsItemValue, { color: theme.textSecondary }]}>1.0.0</Text>
          </View>

          <Text style={styles.footerText}>Made by Rishabh</Text>

          <Modal visible={isCustomEventModalVisible} transparent animationType="fade" onRequestClose={() => setIsCustomEventModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, themedCardStyle]}>
                <Text style={[styles.modalTitle, { color: theme.border }]}>Add Custom Event</Text>

                <Text style={[styles.inputLabel, { color: theme.border }]}>Stroke</Text>
                <HapticPressable
                  style={[styles.themeToggleButton, { borderColor: theme.border, marginBottom: 8 }]}
                  onPress={() => setIsStrokeDropdownOpen((prev) => !prev)}
                >
                  <Text style={[styles.themeToggleText, { color: theme.textPrimary }]}>
                    {selectedStrokeOption || 'Select stroke'}
                  </Text>
                </HapticPressable>
                {isStrokeDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {STROKE_OPTIONS.map((stroke) => (
                      <HapticPressable
                        key={stroke}
                        style={[styles.dropdownItem, { borderColor: theme.border }]}
                        onPress={() => {
                          setSelectedStrokeOption(stroke);
                          setIsStrokeDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: theme.textPrimary }]}>{stroke}</Text>
                      </HapticPressable>
                    ))}
                  </View>
                )}

                <Text style={[styles.inputLabel, { color: theme.border }]}>Distance</Text>
                <HapticPressable
                  style={[styles.themeToggleButton, { borderColor: theme.border, marginBottom: 8 }]}
                  onPress={() => setIsDistanceDropdownOpen((prev) => !prev)}
                >
                  <Text style={[styles.themeToggleText, { color: theme.textPrimary }]}>
                    {selectedDistanceOption
                      ? `${formatDistanceLabel(selectedDistanceOption)}${selectedDistanceOption === 5000 || selectedDistanceOption === 10000 ? '' : 'M'}`
                      : 'Select distance'}
                  </Text>
                </HapticPressable>
                {isDistanceDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {DISTANCE_OPTIONS.map((distance) => (
                      <HapticPressable
                        key={distance}
                        style={[styles.dropdownItem, { borderColor: theme.border }]}
                        onPress={() => {
                          setSelectedDistanceOption(distance);
                          setIsDistanceDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: theme.textPrimary }]}>
                          {distance === 5000 || distance === 10000 ? `${distance / 1000}KM` : `${distance}M`}
                        </Text>
                      </HapticPressable>
                    ))}
                  </View>
                )}

                <View style={styles.modalActionColumn}>
                  <HapticPressable
                    style={styles.addButton}
                    onPress={() => {
                      if (!selectedStrokeOption || !selectedDistanceOption) return;
                      const label = buildEventLabel(selectedStrokeOption, selectedDistanceOption);
                      const alreadyExists = allEvents.includes(label);
                      if (alreadyExists) {
                        Alert.alert('Event already exists', 'That custom event is already in your list.');
                        return;
                      }
                      setCustomEvents((prev) => [
                        ...prev,
                        {
                          label,
                          stroke: selectedStrokeOption,
                          distance: selectedDistanceOption,
                        },
                      ]);
                      setSelectedStrokeOption('');
                      setSelectedDistanceOption(null);
                      setIsStrokeDropdownOpen(false);
                      setIsDistanceDropdownOpen(false);
                      setIsCustomEventModalVisible(false);
                    }}
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </HapticPressable>

                  <HapticPressable style={[styles.modalCloseButton, styles.customEventCancelButton]} onPress={() => setIsCustomEventModalVisible(false)}>
                    <Text style={styles.modalCloseButtonText}>Cancel</Text>
                  </HapticPressable>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedEvent) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.container}>
          <View style={[styles.homeHeaderCard, themedCardStyle]}>
            <View style={styles.homeTitleRow}>
              <View style={styles.homeTitleWrap}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Swim Timings Tracker</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {userName ? `Welcome ${userName}` : 'Select an event'}
                </Text>
              </View>
              <HapticPressable
                style={[styles.settingsButton, { borderColor: theme.border, backgroundColor: theme.border }]}
                onPress={() => setActivePage('settings')}
              >
                <Text style={[styles.settingsButtonText, { color: '#ffffff' }]}>⚙</Text>
              </HapticPressable>
            </View>
          </View>

          <FlatList
            data={allEvents}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.eventList}
            renderItem={({ item }) => (
              <HapticPressable style={[styles.eventCard, themedCardStyle]} onPress={() => setSelectedEvent(item)}>
                <View style={styles.eventCardRow}>
                  <View style={styles.eventTitleGroup}>
                    <Text style={[styles.eventText, { color: theme.textPrimary }]}>{item}</Text>
                    {customEventLabelSet.has(item) && (
                      <View style={[styles.customBadge, { borderColor: theme.border }]}>
                        <Text style={[styles.customBadgeText, { color: theme.border }]}>Custom</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.eventBestTime, { color: theme.textSecondary }]}>
                    {bestTimeByEvent[item] ? formatSeconds(bestTimeByEvent[item].timeSeconds) : '—'}
                  </Text>
                </View>
              </HapticPressable>
            )}
          />
          <Text style={styles.footerText}>Made by Rishabh</Text>

          <Modal visible={isNamePromptVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, themedCardStyle]}>
                <Text style={[styles.modalTitle, { color: theme.border }]}>What is your name?</Text>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="Enter your name"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.nameInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
                />
                <HapticPressable
                  style={[styles.addButton, { marginTop: 6 }]}
                  onPress={() => {
                    setUserName(nameDraft.trim());
                    setIsNamePromptVisible(false);
                  }}
                >
                  <Text style={styles.addButtonText}>Save Name</Text>
                </HapticPressable>
                <HapticPressable
                  style={[styles.skipNameButton, { borderColor: theme.border }]}
                  onPress={() => setIsNamePromptVisible(false)}
                >
                  <Text style={[styles.skipNameButtonText, { color: theme.border }]}>Skip for now</Text>
                </HapticPressable>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.topBarContainer}>
        <View style={styles.eventHeaderRow}>
          <View style={styles.eventHeaderLeft}>
            <HapticPressable style={[styles.backButton, themedCardStyle]} onPress={handleBackToEventList}>
              <Text style={[styles.backButtonText, { color: theme.textPrimary }]}>←</Text>
            </HapticPressable>
            <View style={styles.eventTitleStack}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>{selectedEvent}</Text>
              {isSelectedEventCustom && (
                <View style={[styles.customBadge, { borderColor: theme.border }]}>
                  <Text style={[styles.customBadgeText, { color: theme.border }]}>Custom</Text>
                </View>
              )}
            </View>
          </View>
          {isSelectedEventCustom && (
            <HapticPressable style={[styles.deleteCustomEventButton, themedCardStyle]} onPress={confirmDeleteCustomEvent}>
              <Text style={[styles.deleteCustomEventButtonText, { color: '#b91c1c' }]}>Delete custom event</Text>
            </HapticPressable>
          )}
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.eventScrollContent}>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, themedCardStyle]}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Latest</Text>
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>
              {latestEntry ? `${latestEntry.timeInput} • ${latestEntry.date}` : 'No times yet'}
            </Text>
          </View>

          <View style={[styles.summaryCard, themedCardStyle]}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Fastest</Text>
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>
              {fastestEntry ? `${formatSeconds(fastestEntry.timeSeconds)} • ${fastestEntry.date}` : 'No times yet'}
            </Text>
          </View>
        </View>

        <View style={[styles.inputCard, themedCardStyle]}>
          <Text style={[styles.inputLabel, { color: theme.border }]}>
            {shouldShowHourDial ? 'Time (HH:MM:SS.CS) *' : 'Time (MM:SS.CS) *'}
          </Text>
          <View style={styles.timeDialRow}>
            {shouldShowHourDial && (
              <>
                <SpinDial
                  label="Hours"
                  value={timeDialValues.hours}
                  maxValue={23}
                  onChange={(nextValue) => updateDialValue('hours', nextValue)}
                  resetSignal={dialResetSignal}
                  accentColor={theme.border}
                  dialBackgroundColor={isDarkMode ? '#0b1630' : '#eef4ff'}
                  compact={shouldShowHourDial}
                />
                <Text style={[styles.timeSeparator, shouldShowHourDial && styles.timeSeparatorCompact, { color: theme.border }]}>
                  :
                </Text>
              </>
            )}
            <SpinDial
              label="Minutes"
              value={timeDialValues.minutes}
              maxValue={59}
              onChange={(nextValue) => updateDialValue('minutes', nextValue)}
              resetSignal={dialResetSignal}
              accentColor={theme.border}
              dialBackgroundColor={isDarkMode ? '#0b1630' : '#eef4ff'}
              compact={shouldShowHourDial}
            />
            <Text style={[styles.timeSeparator, shouldShowHourDial && styles.timeSeparatorCompact, { color: theme.border }]}>:</Text>
            <SpinDial
              label="Seconds"
              value={timeDialValues.seconds}
              maxValue={59}
              onChange={(nextValue) => updateDialValue('seconds', nextValue)}
              resetSignal={dialResetSignal}
              accentColor={theme.border}
              dialBackgroundColor={isDarkMode ? '#0b1630' : '#eef4ff'}
              compact={shouldShowHourDial}
            />
            <Text style={[styles.timeSeparator, shouldShowHourDial && styles.timeSeparatorCompact, { color: theme.border }]}>.</Text>
            <SpinDial
              label="Milliseconds"
              value={timeDialValues.centiseconds}
              maxValue={99}
              onChange={(nextValue) => updateDialValue('centiseconds', nextValue)}
              resetSignal={dialResetSignal}
              accentColor={theme.border}
              dialBackgroundColor={isDarkMode ? '#0b1630' : '#eef4ff'}
              compact={shouldShowHourDial}
            />
          </View>
          <Text style={[styles.dialPreviewText, { color: theme.border }]}>Selected Time: {dialTimePreview}</Text>

          <Text style={[styles.inputLabel, { color: theme.border }]}>Date *</Text>
          <HapticPressable
            style={[styles.datePickerButton, themedCardStyle]}
            onPress={() => {
              setIsDatePickerOpen(true);
              if (selectedDateTimestamp !== null) {
                setCalendarViewDate(new Date(selectedDateTimestamp));
              }
            }}
          >
            <Text style={dateInput ? styles.datePickerButtonText : styles.datePickerPlaceholder}>
              {dateInput || 'Choose a date'}
            </Text>
            <Text style={styles.datePickerArrow}>▾</Text>
          </HapticPressable>

          <HapticPressable style={styles.addButton} onPress={handleAddTime}>
            <Text style={styles.addButtonText}>Add Time</Text>
          </HapticPressable>
        </View>

        <Text style={[styles.historyTitle, { color: theme.border }]}>History</Text>

        <FlatList
          data={sortedEntries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.historyList}
          ListEmptyComponent={<Text style={styles.emptyText}>No entries yet.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.historyCard, themedCardStyle]}>
              <View style={styles.historyTextWrap}>
                <Text style={[styles.historyTime, { color: theme.border }]}>{item.timeInput}</Text>
                <Text style={styles.historyDate}>{item.date}</Text>
              </View>
              <HapticPressable style={styles.deleteButton} onPress={() => confirmDeleteEntry(item)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </HapticPressable>
            </View>
          )}
          scrollEnabled={false}
        />
        <Text style={styles.footerText}>Made by Rishabh</Text>
      </ScrollView>

      <Modal visible={isDatePickerOpen} transparent animationType="fade" onRequestClose={() => setIsDatePickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, themedCardStyle]}>
            <Text style={[styles.modalTitle, { color: theme.border }]}>Select Date</Text>

            <View style={styles.calendarHeaderRow}>
              <HapticPressable
                style={[styles.calendarNavButton, { backgroundColor: theme.border }]}
                onPress={() =>
                  setCalendarViewDate(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
              >
                <Text style={[styles.calendarNavButtonText, { color: '#ffffff' }]}>‹</Text>
              </HapticPressable>
              <Text style={[styles.calendarHeaderText, { color: theme.border }]}>{formatCalendarHeader(calendarViewDate)}</Text>
              <HapticPressable
                style={[styles.calendarNavButton, { backgroundColor: theme.border }]}
                onPress={() =>
                  setCalendarViewDate(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
              >
                <Text style={[styles.calendarNavButtonText, { color: '#ffffff' }]}>›</Text>
              </HapticPressable>
            </View>

            <View style={styles.yearControlsRow}>
              <HapticPressable
                style={[styles.yearControlButton, { backgroundColor: theme.border }]}
                onPress={() =>
                  setCalendarViewDate(
                    (prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1)
                  )
                }
              >
                <Text style={[styles.yearControlText, { color: '#ffffff' }]}>-1 Year</Text>
              </HapticPressable>
              <HapticPressable
                style={[styles.yearControlButton, { backgroundColor: theme.border }]}
                onPress={() =>
                  setCalendarViewDate(
                    (prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1)
                  )
                }
              >
                <Text style={[styles.yearControlText, { color: '#ffffff' }]}>+1 Year</Text>
              </HapticPressable>
            </View>

            <View style={styles.weekDaysRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel) => (
                <Text key={dayLabel} style={[styles.weekDayText, { color: theme.border }]}>
                  {dayLabel}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((dateObj, index) => {
                if (!dateObj) {
                  return <View key={`empty-${index}`} style={styles.calendarCell} />;
                }

                const isoValue = toISODate(dateObj);
                const isSelected = isoValue === dateInput;
                const isFutureDate = parseDateToTimestamp(isoValue) > todayDateTimestamp;

                return (
                  <HapticPressable
                    key={isoValue}
                    disabled={isFutureDate}
                    style={[
                      styles.calendarCell,
                      styles.calendarDayButton,
                      {
                        borderColor: isFutureDate ? '#9ab0d4' : theme.border,
                        backgroundColor: isFutureDate ? '#d9dde6' : isDarkMode ? '#162338' : '#edf3ff',
                      },
                      isSelected && [styles.calendarDaySelected, { borderColor: theme.border, backgroundColor: theme.border }],
                    ]}
                    onPress={() => {
                      if (isFutureDate) return;
                      setDateInput(isoValue);
                      setIsDatePickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        { color: isFutureDate ? '#8f98ac' : isSelected ? '#ffffff' : theme.border },
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {dateObj.getDate()}
                    </Text>
                  </HapticPressable>
                );
              })}
            </View>

            <HapticPressable style={styles.modalCloseButton} onPress={() => setIsDatePickerOpen(false)}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </HapticPressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subtlePressFeedback: {
    transform: [{ scale: 0.988 }],
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  disabledPressable: {
    opacity: 0.78,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  topBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  eventScrollContent: {
    paddingBottom: 20,
  },
  homeHeaderCard: {
    backgroundColor: '#162338',
    borderWidth: 1,
    borderColor: '#24324b',
    borderRadius: 12,
    padding: 14,
    marginTop: 30,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e7edf8',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#9baccc',
  },
  homeTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  homeTitleWrap: {
    flex: 1,
    paddingRight: 8,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#24324b',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  settingsButtonText: {
    color: '#dce7fb',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  eventList: {
    paddingBottom: 16,
  },
  eventCard: {
    backgroundColor: '#162338',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#24324b',
  },
  eventText: {
    color: '#f1f5ff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  eventCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  eventBestTime: {
    color: '#9baccc',
    fontSize: 14,
    fontWeight: '700',
  },
  customBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 10,
    gap: 8,
  },
  eventHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  eventTitleStack: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 4,
  },
  deleteCustomEventButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#b91c1c',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteCustomEventButtonText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  settingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 30,
    marginBottom: 16,
  },
  settingsCard: {
    backgroundColor: '#162338',
    borderWidth: 1,
    borderColor: '#24324b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  settingsItemTitle: {
    color: '#e7edf8',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  settingsItemValue: {
    color: '#9baccc',
    fontSize: 14,
    fontWeight: '600',
  },
  themeToggleButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  themeToggleText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  dropdownList: {
    marginBottom: 10,
  },
  dropdownItem: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  skipNameButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipNameButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#162338',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  backButtonText: {
    color: '#c8d4ec',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#162338',
    borderWidth: 1,
    borderColor: '#24324b',
    borderRadius: 12,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9baccc',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: '#f3f7ff',
    fontSize: 13,
    fontWeight: '600',
  },
  inputCard: {
    backgroundColor: '#162338',
    borderWidth: 1,
    borderColor: '#24324b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  inputLabel: {
    color: '#c8d4ec',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f1a2d',
    color: '#f1f5ff',
    borderColor: '#2a3a59',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  timeDialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  dialWrap: {
    alignItems: 'center',
    width: 72,
  },
  dialWrapCompact: {
    width: 63,
  },
  dialLabel: {
    color: '#9baccc',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  dialLabelCompact: {
    fontSize: 11,
    marginBottom: 6,
  },
  dialValueBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialValueBoxCompact: {
    width: 63,
  },
  dialValueViewport: {
    width: 72,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#0f1a2d',
    borderWidth: 1,
    borderColor: '#2a3a59',
    position: 'relative',
  },
  dialValueViewportCompact: {
    width: 63,
    borderRadius: 9,
  },
  dialItemsLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 0,
  },
  dialWheelText: {
    color: '#dce7fb',
    fontSize: 24,
    fontWeight: '700',
  },
  dialWheelTextCompact: {
    fontSize: 21,
  },
  dialCenterHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#3c82f6',
    backgroundColor: 'rgba(60, 130, 246, 0.12)',
  },
  timeSeparator: {
    color: '#c8d4ec',
    fontSize: 30,
    fontWeight: '800',
    marginHorizontal: -2,
    marginTop: 48,
  },
  timeSeparatorCompact: {
    fontSize: 25,
    marginTop: 39,
  },
  dialPreviewText: {
    color: '#9baccc',
    fontSize: 12,
    marginBottom: 2,
  },
  datePickerButton: {
    backgroundColor: '#0f1a2d',
    borderColor: '#2a3a59',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerButtonText: {
    color: '#f1f5ff',
    fontSize: 15,
    textAlign: 'center',
  },
  datePickerPlaceholder: {
    color: '#6f7a8a',
    fontSize: 15,
    textAlign: 'center',
  },
  datePickerArrow: {
    color: '#9baccc',
    fontSize: 15,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#3c82f6',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 2,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  historyTitle: {
    color: '#e7edf8',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  historyList: {
    paddingBottom: 8,
  },
  historyCard: {
    backgroundColor: '#162338',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24324b',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  historyTime: {
    color: '#f3f7ff',
    fontSize: 16,
    fontWeight: '700',
  },
  historyDate: {
    color: '#9baccc',
    marginTop: 2,
    fontSize: 13,
  },
  deleteButton: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: '#ffe4e4',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#9baccc',
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxHeight: '75%',
    backgroundColor: '#111b2d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24324b',
    padding: 14,
  },
  modalTitle: {
    color: '#e7edf8',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalActionColumn: {
    marginTop: 10,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#24324b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavButtonText: {
    color: '#d5e1f5',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  calendarHeaderText: {
    color: '#e7edf8',
    fontSize: 16,
    fontWeight: '700',
  },
  yearControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  yearControlButton: {
    backgroundColor: '#24324b',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  yearControlText: {
    color: '#d5e1f5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    color: '#9baccc',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginBottom: 12,
  },
  calendarCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  calendarDayButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#24324b',
    backgroundColor: '#162338',
  },
  calendarDaySelected: {
    borderColor: '#3c82f6',
    backgroundColor: '#1d2f4e',
  },
  calendarDayText: {
    color: '#f1f5ff',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarDayTextSelected: {
    color: '#ffffff',
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#24324b',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  customEventCancelButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseButtonText: {
    color: '#d5e1f5',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  footerText: {
    color: '#6f7a8a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
});
