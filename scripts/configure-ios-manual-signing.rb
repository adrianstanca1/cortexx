#!/usr/bin/env ruby
# Configure the App target only; do not override CocoaPods signing settings.
# Run on a macOS CI runner after CocoaPods has installed the xcodeproj gem.
require 'xcodeproj'

team_id = ENV.fetch('APPLE_TEAM_ID')
abort('APPLE_TEAM_ID is required for manual distribution signing') if team_id.strip.empty?

project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |target| target.name == 'App' }
abort('Cannot find App target in Xcode project') unless app_target

release_config = app_target.build_configurations.find { |config| config.name == 'Release' }
abort('Cannot find App Release build configuration') unless release_config

release_config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
release_config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
release_config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = 'Cortexx App Store'
release_config.build_settings['DEVELOPMENT_TEAM'] = team_id
project.save

puts('Configured manual Apple Distribution signing for App Release target only.')
