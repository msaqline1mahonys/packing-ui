"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickerDay } from "@mui/x-date-pickers/PickerDay";
import { CalendarIcon, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "react-day-picker/dist/style.css";

dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

const CustomDateRangePicker = ({
  value = [null, null],
  onChange,
  format = "DD/MM/YYYY",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(value[0]);
  const [endDate, setEndDate] = useState(value[1]);
  const [hoverDate, setHoverDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [secondMonth, setSecondMonth] = useState(dayjs().add(1, "month"));
  const [inputValue, setInputValue] = useState("");
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const popoverRef = useRef(null);
  const inputRef = useRef(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setStartDate(value[0]);
    setEndDate(value[1]);
    // Update input value when external value changes
    if (value[0] && value[1]) {
      setInputValue(`${value[0].format(format)} – ${value[1].format(format)}`);
    } else if (value[0]) {
      setInputValue(value[0].format(format));
    } else {
      setInputValue("");
    }
  }, [value, format]);

  // Update popover position when open (for portal - fixed positioning)
  const updatePopoverPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const margin = 8;
    const popoverWidth = popoverRef.current?.offsetWidth || 0;
    const popoverHeight = popoverRef.current?.offsetHeight || 0;

    let left = rect.left;
    if (popoverWidth) {
      const maxLeft = window.innerWidth - popoverWidth - margin;
      if (left > maxLeft) left = Math.max(margin, maxLeft);
    }

    let top = rect.bottom + margin;
    if (popoverHeight) {
      const maxTop = window.innerHeight - popoverHeight - margin;
      // If it would overflow the bottom, open above the input instead.
      if (top > maxTop) {
        const above = rect.top - popoverHeight - margin;
        top = above >= margin ? above : Math.max(margin, maxTop);
      }
    }

    setPopoverPosition({ top, left });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePopoverPosition();
      const handleScrollOrResize = () => updatePopoverPosition();
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleDateClick = (date) => {
    if (!startDate || (startDate && endDate)) {
      // Start new range
      setStartDate(date);
      setEndDate(null);
      setInputValue(date.format(format));
    } else if (date.isBefore(startDate)) {
      // Clicked before start, make it the new start
      setStartDate(date);
      setEndDate(null);
      setInputValue(date.format(format));
    } else {
      // Set end date and close
      setEndDate(date);
      setInputValue(`${startDate.format(format)} – ${date.format(format)}`);
      onChange([startDate, date]);
      setTimeout(() => setIsOpen(false), 300);
    }
  };

  const handleShortcut = (shortcut) => {
    const today = dayjs();
    let from, to;

    switch (shortcut) {
      case "This Week":
        from = today.startOf("week");
        to = today.endOf("week");
        break;
      case "Last Week":
        from = today.subtract(1, "week").startOf("week");
        to = today.subtract(1, "week").endOf("week");
        break;
      case "Last 7 Days":
        from = today.subtract(7, "day");
        to = today;
        break;
      case "This Month":
        from = today.startOf("month");
        to = today.endOf("month");
        break;
      case "Last Month":
        from = today.subtract(1, "month").startOf("month");
        to = today.subtract(1, "month").endOf("month");
        break;
      case "Reset":
        from = null;
        to = null;
        break;
      default:
        return;
    }

    setStartDate(from);
    setEndDate(to);
    if (from && to) {
      setInputValue(`${from.format(format)} – ${to.format(format)}`);
    } else {
      setInputValue("");
    }
    onChange([from, to]);
    if (shortcut === "Reset") {
      setIsOpen(false);
    }
  };

  const renderDay = (day, selectedDays, pickersDayProps) => {
    const isSelected =
      (startDate && day.isSame(startDate, "day")) ||
      (endDate && day.isSame(endDate, "day"));
    const isInRange =
      startDate && endDate && day.isBetween(startDate, endDate, "day", "[]");
    const isHoverInRange =
      startDate &&
      !endDate &&
      hoverDate &&
      day.isBetween(startDate, hoverDate, "day", "[]");

    return (
      <div
        onMouseEnter={() => setHoverDate(day)}
        style={{
          position: "relative",
          backgroundColor:
            isInRange || isHoverInRange ? "#e3f2fd" : "transparent",
        }}
      >
        <PickerDay
          {...pickersDayProps}
          day={day}
          selected={isSelected}
          sx={{
            ...(isSelected && {
              backgroundColor: "#1976d2 !important",
              color: "white !important",
              fontWeight: "bold",
            }),
            ...(isInRange && {
              backgroundColor: "#e3f2fd",
              "&:hover": {
                backgroundColor: "#bbdefb",
              },
            }),
          }}
          onDaySelect={() => handleDateClick(day)}
        />
      </div>
    );
  };

  const handleInputChange = (e) => {
    const input = e.target.value;
    setInputValue(input);

    // Try to parse the input - support multiple formats
    // Support formats like:
    // "01/12/2024 – 31/12/2024" or "01/12/2024 - 31/12/2024"
    // "01/12/2024" (single date)
    const parts = input.split(/\s*[-–—]\s*/); // Split by any dash variant with optional spaces

    // Supported date formats
    const formats = [
      "DD/MM/YYYY",
      "D/M/YYYY",
      "DD-MM-YYYY",
      "D-M-YYYY",
      "YYYY-MM-DD",
    ];

    if (parts.length === 2) {
      // Try to parse both dates with multiple format attempts
      let parsedStart = null;
      let parsedEnd = null;

      for (const fmt of formats) {
        if (!parsedStart || !parsedStart.isValid()) {
          parsedStart = dayjs(parts[0].trim(), fmt, true);
        }
        if (!parsedEnd || !parsedEnd.isValid()) {
          parsedEnd = dayjs(parts[1].trim(), fmt, true);
        }
        if (parsedStart.isValid() && parsedEnd.isValid()) break;
      }

      if (
        parsedStart &&
        parsedStart.isValid() &&
        parsedEnd &&
        parsedEnd.isValid()
      ) {
        setStartDate(parsedStart);
        setEndDate(parsedEnd);
        onChange([parsedStart, parsedEnd]);
      }
    } else if (parts.length === 1 && parts[0].trim()) {
      // Parse single date with multiple format attempts
      let parsed = null;
      for (const fmt of formats) {
        parsed = dayjs(parts[0].trim(), fmt, true);
        if (parsed.isValid()) break;
      }

      if (parsed && parsed.isValid()) {
        setStartDate(parsed);
        setEndDate(null);
      }
    }
  };

  const handleInputBlur = () => {
    // Reformat the input value on blur
    if (startDate && endDate) {
      setInputValue(`${startDate.format(format)} – ${endDate.format(format)}`);
    } else if (startDate) {
      setInputValue(startDate.format(format));
    } else {
      setInputValue("");
    }
  };

  const shortcuts = [
    "This Week",
    "Last Week",
    "Last 7 Days",
    "This Month",
    "Last Month",
    "Reset",
  ];

  // Convert dayjs to Date for react-day-picker
  const dayjsToDate = (date) => {
    if (!date || !date.isValid()) return undefined;
    return date.toDate();
  };

  // Convert Date to dayjs
  const dateToDayjs = (date) => {
    if (!date) return null;
    return dayjs(date);
  };

  // Handle react-day-picker range selection
  const handleMobileRangeSelect = (range) => {
    if (range?.from) {
      const fromDayjs = dateToDayjs(range.from);
      setStartDate(fromDayjs);

      if (range.to) {
        const toDayjs = dateToDayjs(range.to);
        setEndDate(toDayjs);
        onChange([fromDayjs, toDayjs]);
        // Close modal after selecting both dates
        setTimeout(() => setIsOpen(false), 300);
      } else {
        setEndDate(null);
        onChange([fromDayjs, null]);
      }
    } else {
      setStartDate(null);
      setEndDate(null);
      onChange([null, null]);
    }
  };

  // Mobile view: button with calendar modal
  if (isMobile) {
    const displayText =
      startDate && endDate
        ? `${startDate.format(format)} – ${endDate.format(format)}`
        : startDate
        ? startDate.format(format)
        : "Select date range";

    return (
      <>
        <div className="flex items-center gap-1.5 w-full">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex-1 min-w-0 h-9 px-2 text-sm text-left bg-white border border-gray-300 rounded-sm hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 flex items-center justify-between"
          >
            <span className="truncate text-gray-700">{displayText}</span>
            <CalendarIcon className="w-4 h-4 text-gray-500 shrink-0 ml-2" />
          </button>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStartDate(null);
                setEndDate(null);
                setInputValue("");
                onChange([null, null]);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mobile Calendar Modal */}
        {isOpen &&
          createPortal(
            <div
              className="fixed inset-0 bg-black/50 z-9999 flex items-center justify-center p-4"
              onClick={() => setIsOpen(false)}
            >
              <div
                className="bg-white rounded-lg shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Select Date Range
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="p-4">
                  <DayPicker
                    mode="range"
                    selected={{
                      from: dayjsToDate(startDate),
                      to: dayjsToDate(endDate),
                    }}
                    onSelect={handleMobileRangeSelect}
                    numberOfMonths={1}
                    className="rdp-mobile"
                    classNames={{
                      months: "flex flex-col",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button:
                        "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell:
                        "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-blue-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md",
                      day_range_start: "day-range-start",
                      day_range_end: "day-range-end",
                      day_selected:
                        "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                      day_today: "bg-blue-100 text-blue-900 font-semibold",
                      day_outside:
                        "day-outside text-gray-400 opacity-50 aria-selected:bg-gray-100/50 aria-selected:text-gray-400 aria-selected:opacity-30",
                      day_disabled: "text-gray-400 opacity-50",
                      day_range_middle:
                        "aria-selected:bg-blue-50 aria-selected:text-blue-900",
                      day_hidden: "invisible",
                    }}
                    styles={{
                      months: {
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      },
                      month: { margin: 0 },
                      caption: {
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        paddingTop: "0.5rem",
                        position: "relative",
                      },
                      nav: { display: "flex", gap: "0.25rem" },
                      table: { width: "100%", borderCollapse: "collapse" },
                      head_row: { display: "flex", marginTop: "0.5rem" },
                      head_cell: {
                        width: "2.25rem",
                        fontSize: "0.875rem",
                        fontWeight: "normal",
                        color: "#6b7280",
                      },
                      row: { display: "flex", width: "100%", marginTop: "0.5rem" },
                      cell: {
                        textAlign: "center",
                        fontSize: "0.875rem",
                        padding: 0,
                        position: "relative",
                      },
                      day: {
                        height: "2.25rem",
                        width: "2.25rem",
                        padding: 0,
                        fontWeight: "normal",
                        borderRadius: "0.375rem",
                      },
                      day_selected: { backgroundColor: "#2563eb", color: "#ffffff" },
                      day_today: {
                        backgroundColor: "#dbeafe",
                        color: "#1e40af",
                        fontWeight: "600",
                      },
                    }}
                  />
                </div>
                <div className="p-4 border-t flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate(null);
                      setEndDate(null);
                      setInputValue("");
                      onChange([null, null]);
                      setIsOpen(false);
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  // Desktop view: existing popover calendar
  return (
    <div className="relative">
      {/* Input Field */}
      <div
        ref={inputRef}
        className="flex items-center h-9 px-3 bg-white border border-gray-300 rounded-sm hover:border-blue-500 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
        style={{ width: "100%" }}
      >
        <CalendarIcon
          className="w-4 h-4 text-gray-500 mr-2 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          placeholder="DD/MM/YYYY – DD/MM/YYYY"
          className="flex-1 text-sm outline-none bg-transparent"
        />
        {(startDate || endDate) && (
          <X
            className="w-4 h-4 text-gray-400 hover:text-gray-600 ml-2 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setStartDate(null);
              setEndDate(null);
              setInputValue("");
              onChange([null, null]);
            }}
          />
        )}
      </div>

      {/* Popover - rendered via portal to escape overflow clipping (e.g. in scheduler toolbar) */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-9999"
            style={{
              width: "max-content",
              top: popoverPosition.top,
              left: popoverPosition.left,
            }}
          >
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className="flex">
                {/* Shortcuts */}
                <div
                  className="border-r border-gray-200 p-2"
                  style={{ width: "115px" }}
                >
                  <div className="text-xs font-semibold text-gray-500 mb-2 px-1">
                    Quick
                  </div>
                  <div className="space-y-0.5">
                    {shortcuts.map((shortcut) => (
                      <button
                        key={shortcut}
                        onClick={() => handleShortcut(shortcut)}
                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-blue-50 transition-colors text-gray-700 hover:text-blue-600"
                      >
                        {shortcut}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calendars */}
                <div className="flex p-2">
                  {/* First Calendar */}
                  <div className="border-r border-gray-100 pr-2">
                    <DateCalendar
                      value={currentMonth}
                      onChange={(newValue) => setCurrentMonth(newValue)}
                      slots={{
                        day: (dayProps) => renderDay(dayProps.day, [], dayProps),
                      }}
                      showDaysOutsideCurrentMonth
                      sx={{
                        "& .MuiPickersCalendarHeader-root": {
                          paddingLeft: 1,
                          paddingRight: 1,
                        },
                        "& .MuiDayCalendar-header": {
                          justifyContent: "space-around",
                        },
                        "& .MuiPickersDay-root": {
                          fontSize: "0.875rem",
                        },
                      }}
                    />
                  </div>

                  {/* Second Calendar */}
                  <div className="pl-2">
                    <DateCalendar
                      value={secondMonth}
                      onChange={(newValue) => setSecondMonth(newValue)}
                      slots={{
                        day: (dayProps) => renderDay(dayProps.day, [], dayProps),
                      }}
                      showDaysOutsideCurrentMonth
                      sx={{
                        "& .MuiPickersCalendarHeader-root": {
                          paddingLeft: 1,
                          paddingRight: 1,
                        },
                        "& .MuiDayCalendar-header": {
                          justifyContent: "space-around",
                        },
                        "& .MuiPickersDay-root": {
                          fontSize: "0.875rem",
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
            </LocalizationProvider>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CustomDateRangePicker;
