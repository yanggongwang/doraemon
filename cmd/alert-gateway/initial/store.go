package initial

import (
	"sync"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	marker types.Marker
	once   sync.Once
)

func GetMarker() types.Marker {
	once.Do(func() {
		marker = types.NewMarker(prometheus.DefaultRegisterer)
	})
	return marker
}
