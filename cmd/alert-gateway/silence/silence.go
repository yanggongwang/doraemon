package silence

import (
	alertmanagerSilence "github.com/prometheus/alertmanager/silence"
)

var (
	Silences *alertmanagerSilence.Silences
	Silencer *alertmanagerSilence.Silencer
)
