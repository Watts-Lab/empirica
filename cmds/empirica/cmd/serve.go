package cmd

import (
	"github.com/empiricaly/empirica/internal/bundle"
	"github.com/empiricaly/empirica/internal/settings"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func addServeCommand(parent *cobra.Command) error {
	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Serve bundle",
		// 	Long: ``,
		SilenceUsage:  true,
		SilenceErrors: true,
		Args:          cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) != 1 {
				return errors.New("missing project name")
			}

			ctx := initContext()

			clean, err := cmd.Flags().GetBool("clean")
			if err != nil {
				return errors.Wrap(err, "parse clean flag")
			}

			addr, err := cmd.Flags().GetString("addr")
			if err != nil {
				return errors.Wrap(err, "parse ddr flag")
			}

			if err := settings.InstallVoltaIfNeeded(ctx); err != nil {
				return errors.Wrap(err, "check node")
			}

			in := args[0]

			conf := getConfig()
			conf.Server.Addr = addr

			return bundle.Serve(ctx, conf, in, clean)
		},
	}

	cmd.Flags().Bool("clean", false, "cleanup old installation")

	flag := "addr"
	sval := ":3000"
	cmd.Flags().String(flag, sval, "Address of the server")
	viper.SetDefault(flag, sval)

	err := viper.BindPFlags(cmd.Flags())
	if err != nil {
		return errors.Wrap(err, "bind serve flags")
	}

	parent.AddCommand(cmd)

	return nil
}