import React, { useState } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Umbrella,
  Eye,
  Gauge,
} from 'lucide-react';

/**
 * WeatherWidget
 *
 * Displays current weather for site, 5-day forecast,
 * weather alerts, and site-specific conditions.
 *
 * @param props - Component props
 * @returns JSX element displaying weather information
 *
 * @example
 * ```tsx
 * <WeatherWidget
 *   siteId="site-123"
 *   location="London, UK"
 *   onAlertClick={(alert) => handleAlert(alert)}
 * />
 * ```
 */

export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'partly_cloudy'
  | 'rain'
  | 'heavy_rain'
  | 'snow'
  | 'thunderstorm'
  | 'fog'
  | 'windy';

export type AlertLevel = 'info' | 'warning' | 'severe';
export type WeatherSize = 'small' | 'medium' | 'large';

export interface WeatherAlert {
  id: string;
  type: string;
  message: string;
  level: AlertLevel;
  startTime: string;
  endTime?: string;
}

export interface DailyForecast {
  date: string;
  dayName: string;
  condition: WeatherCondition;
  tempHigh: number;
  tempLow: number;
  precipitation: number;
  windSpeed: number;
}

export interface WeatherData {
  location: string;
  condition: WeatherCondition;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  visibility: number;
  pressure: number;
  uvIndex: number;
  precipitation: number;
  lastUpdated: string;
  forecast: DailyForecast[];
  alerts: WeatherAlert[];
}

export interface WeatherWidgetProps {
  /** Site location */
  location?: string;
  /** Site ID for weather data */
  siteId?: string;
  /** Click handler for alerts */
  onAlertClick?: (alert: WeatherAlert) => void;
  /** Size variant */
  size?: WeatherSize;
  /** Show 5-day forecast */
  showForecast?: boolean;
  /** Show detailed conditions */
  showDetails?: boolean;
  /** Show alerts */
  showAlerts?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const conditionConfig: Record<WeatherCondition, {
  label: string;
  icon: React.ReactNode;
  gradient: string;
}> = {
  clear: {
    label: 'Clear',
    icon: <Sun className="w-6 h-6" />,
    gradient: 'from-yellow-400 to-orange-500',
  },
  cloudy: {
    label: 'Cloudy',
    icon: <Cloud className="w-6 h-6" />,
    gradient: 'from-gray-400 to-gray-500',
  },
  partly_cloudy: {
    label: 'Partly Cloudy',
    icon: <Sun className="w-6 h-6" />,
    gradient: 'from-blue-400 to-gray-400',
  },
  rain: {
    label: 'Rain',
    icon: <CloudRain className="w-6 h-6" />,
    gradient: 'from-blue-600 to-blue-800',
  },
  heavy_rain: {
    label: 'Heavy Rain',
    icon: <CloudRain className="w-6 h-6" />,
    gradient: 'from-blue-800 to-blue-950',
  },
  snow: {
    label: 'Snow',
    icon: <CloudSnow className="w-6 h-6" />,
    gradient: 'from-blue-100 to-blue-300',
  },
  thunderstorm: {
    label: 'Thunderstorm',
    icon: <CloudLightning className="w-6 h-6" />,
    gradient: 'from-purple-700 to-purple-900',
  },
  fog: {
    label: 'Foggy',
    icon: <Cloud className="w-6 h-6" />,
    gradient: 'from-gray-300 to-gray-400',
  },
  windy: {
    label: 'Windy',
    icon: <Wind className="w-6 h-6" />,
    gradient: 'from-teal-400 to-blue-500',
  },
};

const alertLevelConfig: Record<AlertLevel, {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}> = {
  info: {
    label: 'Info',
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  warning: {
    label: 'Warning',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  severe: {
    label: 'Severe',
    color: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/30',
    icon: <AlertTriangle className="w-4 h-4 fill-current" />,
  },
};

const sizeClasses: Record<WeatherSize, {
  padding: string;
  textSize: string;
  labelSize: string;
  valueSize: string;
  itemPadding: string;
  iconSize: string;
}> = {
  small: {
    padding: 'p-3',
    textSize: 'text-xs',
    labelSize: 'text-xs',
    valueSize: 'text-lg',
    itemPadding: 'p-1.5',
    iconSize: 'w-4 h-4',
  },
  medium: {
    padding: 'p-4',
    textSize: 'text-sm',
    labelSize: 'text-sm',
    valueSize: 'text-2xl',
    itemPadding: 'p-2',
    iconSize: 'w-5 h-5',
  },
  large: {
    padding: 'p-5',
    textSize: 'text-base',
    labelSize: 'text-base',
    valueSize: 'text-3xl',
    itemPadding: 'p-2.5',
    iconSize: 'w-6 h-6',
  },
};

/**
 * Weather Icon Component
 */
function _WeatherIcon({
  condition,
  size,
  className = '',
}: {
  condition: WeatherCondition;
  size: WeatherSize;
  className?: string;
}) {
  const config = conditionConfig[condition];
  const sizes = sizeClasses[size];

  return (
    <div
      className={`inline-flex items-center justify-center p-3 rounded-full bg-gradient-to-br ${config.gradient} text-white ${className}`}
    >
      <div className={sizes.iconSize}>{config.icon}</div>
    </div>
  );
}

/**
 * CurrentWeather Component
 */
function CurrentWeather({
  data,
  size,
}: {
  data: WeatherData;
  size: WeatherSize;
}) {
  const sizes = sizeClasses[size];
  const config = conditionConfig[data.condition];

  return (
    <div className={`bg-gradient-to-br ${config.gradient} rounded-xl p-4 text-white`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 opacity-80" />
            <span className="text-sm font-medium opacity-90">{data.location}</span>
          </div>
          <div className={`${sizes.valueSize} font-bold`}>{data.temperature}°C</div>
          <div className="text-sm opacity-90">{config.label}</div>
          <div className="text-xs opacity-75 mt-1">
            Feels like {data.feelsLike}°C
          </div>
        </div>
        <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
          <div className="w-8 h-8">{config.icon}</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
        <div className="text-center">
          <Droplets className="w-3 h-3 mx-auto mb-1 opacity-75" />
          <div className="text-xs font-medium">{data.humidity}%</div>
        </div>
        <div className="text-center">
          <Wind className="w-3 h-3 mx-auto mb-1 opacity-75" />
          <div className="text-xs font-medium">{data.windSpeed} mph</div>
        </div>
        <div className="text-center">
          <Umbrella className="w-3 h-3 mx-auto mb-1 opacity-75" />
          <div className="text-xs font-medium">{data.precipitation}%</div>
        </div>
      </div>
    </div>
  );
}

/**
 * ForecastDay Component
 */
function ForecastDay({
  forecast,
  size,
}: {
  forecast: DailyForecast;
  size: WeatherSize;
}) {
  const sizes = sizeClasses[size];
  const config = conditionConfig[forecast.condition];

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between`}
    >
      <div className="flex items-center gap-3">
        <div>
          <div className={`${sizes.textSize} font-medium text-gray-900 dark:text-white`}>
            {forecast.dayName}
          </div>
          <div className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
            {new Date(forecast.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`p-1.5 rounded-full bg-gradient-to-br ${config.gradient} text-white`}
        >
          <div className="w-4 h-4">{config.icon}</div>
        </div>
        <div className="text-right">
          <div className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white`}>
            {forecast.tempHigh}°
          </div>
          <div className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
            {forecast.tempLow}°
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Droplets className="w-3 h-3 text-blue-500" />
          <span className={`${sizes.labelSize} text-gray-600 dark:text-gray-400`}>
            {forecast.precipitation}%
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * WeatherDetail Component
 */
function WeatherDetail({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
      <div className="flex justify-center mb-1 text-gray-400">{icon}</div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">
        {value}
        {unit && <span className="text-xs font-normal text-gray-500 ml-0.5">{unit}</span>}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

/**
 * WeatherAlert Component
 */
function WeatherAlertItem({
  alert,
  size,
  onClick,
}: {
  alert: WeatherAlert;
  size: WeatherSize;
  onClick?: () => void;
}) {
  const sizes = sizeClasses[size];
  const config = alertLevelConfig[alert.level];

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg ${config.bg} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-start gap-2">
        <div className={config.color}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`${sizes.textSize} font-semibold ${config.color}`}>
              {config.label}
            </span>
            <span className={`${sizes.labelSize} text-gray-600 dark:text-gray-400`}>
              {alert.type}
            </span>
          </div>
          <p className={`${sizes.labelSize} text-gray-700 dark:text-gray-300 mt-1`}>
            {alert.message}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * WeatherWidget Component
 */
export function WeatherWidget({
  location = 'London, UK',
  siteId: _siteId,
  onAlertClick,
  size = 'medium',
  showForecast = true,
  showDetails = true,
  showAlerts = true,
  isLoading = false,
  onRefresh,
  className = '',
}: WeatherWidgetProps) {
  const sizes = sizeClasses[size];

  // Mock data - replace with actual API call
  const [weather] = useState<WeatherData>({
    location,
    condition: 'partly_cloudy',
    temperature: 18,
    feelsLike: 16,
    humidity: 72,
    windSpeed: 12,
    windDirection: 'SW',
    visibility: 10,
    pressure: 1013,
    uvIndex: 4,
    precipitation: 20,
    lastUpdated: new Date().toISOString(),
    forecast: [
      {
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
        dayName: 'Tomorrow',
        condition: 'rain',
        tempHigh: 16,
        tempLow: 12,
        precipitation: 80,
        windSpeed: 15,
      },
      {
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        dayName: 'Friday',
        condition: 'cloudy',
        tempHigh: 17,
        tempLow: 11,
        precipitation: 30,
        windSpeed: 10,
      },
      {
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
        dayName: 'Saturday',
        condition: 'clear',
        tempHigh: 21,
        tempLow: 13,
        precipitation: 5,
        windSpeed: 8,
      },
      {
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString(),
        dayName: 'Sunday',
        condition: 'partly_cloudy',
        tempHigh: 19,
        tempLow: 12,
        precipitation: 15,
        windSpeed: 11,
      },
      {
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
        dayName: 'Monday',
        condition: 'thunderstorm',
        tempHigh: 15,
        tempLow: 10,
        precipitation: 90,
        windSpeed: 20,
      },
    ],
    alerts: [
      {
        id: '1',
        type: 'Wind Warning',
        message: 'Strong winds expected tomorrow afternoon. Secure loose materials.',
        level: 'warning',
        startTime: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      },
    ],
  });

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className={`${sizes.padding} space-y-3 animate-pulse`}>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className={`${sizes.padding} border-b border-gray-100 dark:border-gray-700 flex items-center justify-between`}>
        <h3 className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white flex items-center gap-2`}>
          <Thermometer className="w-5 h-5 text-blue-600" />
          Site Weather
        </h3>
        <div className="flex items-center gap-2">
          <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
            Updated {new Date(weather.lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`${sizes.padding} space-y-4`}>
        {/* Alerts */}
        {showAlerts && weather.alerts.length > 0 && (
          <div className="space-y-2">
            {weather.alerts.map((alert) => (
              <WeatherAlertItem
                key={alert.id}
                alert={alert}
                size={size}
                onClick={() => onAlertClick?.(alert)}
              />
            ))}
          </div>
        )}

        {/* Current Weather */}
        <CurrentWeather data={weather} size={size} />

        {/* Detailed Conditions */}
        {showDetails && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <WeatherDetail
              icon={<Droplets className="w-4 h-4" />}
              label="Humidity"
              value={weather.humidity}
              unit="%"
            />
            <WeatherDetail
              icon={<Wind className="w-4 h-4" />}
              label="Wind"
              value={`${weather.windSpeed} ${weather.windDirection}`}
              unit="mph"
            />
            <WeatherDetail
              icon={<Eye className="w-4 h-4" />}
              label="Visibility"
              value={weather.visibility}
              unit="km"
            />
            <WeatherDetail
              icon={<Gauge className="w-4 h-4" />}
              label="Pressure"
              value={weather.pressure}
              unit="hPa"
            />
            <WeatherDetail
              icon={<Sun className="w-4 h-4" />}
              label="UV Index"
              value={weather.uvIndex}
            />
            <WeatherDetail
              icon={<Umbrella className="w-4 h-4" />}
              label="Precipitation"
              value={weather.precipitation}
              unit="%"
            />
          </div>
        )}

        {/* 5-Day Forecast */}
        {showForecast && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 mb-3`}>
              5-Day Forecast
            </h4>
            <div className="space-y-2">
              {weather.forecast.slice(0, 5).map((day, index) => (
                <ForecastDay key={index} forecast={day} size={size} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WeatherWidget;
